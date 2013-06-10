/*global $*/
queralyzer.ExplainTree=(function () {
    "use strict";

    function indexById(arr, id) {
        var i = 0,
            r,
            row;
        for (r = 0; r < arr.length; r++) {
            row = arr[r];
            if (row.id && row.id === id) {
                break;
            }
            i += 1;
        }
        return i;
    }

    function recursiveTableName(node) {
        var childArray, filteredChildren;
        if (!node) {
            return;
        }
        if (node.table) {
            return node.table;
        }
        if (node.key) {
            return queralyzer.customMatch(node.key, /(.*?)->/);
        }
        if (node.type === "Bookmark lookup") {
            return node.children[1].table;
        }
        if (node.type === "IMPOSSIBLE") {
            return "<none>";
        }
        if (node.children) {
            childArray = node.children.map(function (c) {
                return recursiveTableName(c);
            });
            filteredChildren = $.grep(childArray, function (elem) {
                return elem !== null;
            });
            return filteredChildren.join(",");
        }
    }

    function filesort(childNode) {
        return {
            type: "Filesort",
            children: [childNode]
        };
    }

    function temporary(childNode, tableName, isScan) {
        var node = {
            type: "TEMPORARY",
            table: "temporary(" + tableName + ")",
            possible_keys: undefined,
            partitions: undefined,
            children: [childNode]
        };
        if (isScan) {
            node = {
                type: "Table scan",
                rows: undefined,
                children: [ childNode ]
            };
        }
        return node;
    }

    function transformRowToNode(row) {
        var sub = row.type,
            childNode,
            warn,
            funcName,
            extra,
            parentNode = {},
            noMatchingRow = [
                "Impossible (?:WHERE|HAVING)(?: noticed after reading const tables)?",
                "No matching.*row",
                "(?:unique|const) row not found"].join("|");

        funcName = "node_" + sub;

        extra = row.Extra;
        childNode = sub
            ? queralyzer.TypeFactory[funcName](row) : extra.match(/No tables/)
            ? { type: (!row.select_type.match(/^(?:PRIMARY|SIMPLE)$/) ? row.select_type : 'DUAL') }
            : extra.match(new RegExp("(?:" + noMatchingRow + ")", "i"))
            ? { type: 'IMPOSSIBLE' } : extra.match(/optimized away/)
            ? { type: 'CONSTANT' } : false;

        if (!childNode) {
            return;
        }

        warn = extra.match(new RegExp(noMatchingRow));

        if (warn) {
            parentNode.warning = warn;
        }
        else {
            parentNode.children = [childNode];
            if (extra.match(/Using where/)) {
                parentNode.type = "Filter with WHERE";
            } else if (extra.match(/Using join buffer/)) {
                parentNode.type = "Join buffer";
            } else if (extra.match(/Distinct|Not exists/)) {
                parentNode.type = "Distinct/Not-Exists";
            } else if (extra.match(/Range checked for each record \(\w+ map: ([^\)]+)\)/)) {
                /* Skipping possible keys for now*/
                parentNode.type = 'Re-evaluate indexes each row';
            } else if (extra.match(/Using filesort/)) {
                parentNode = filesort(childNode);
            } else if (extra.match(/Using temporary/)) {
                parentNode = temporary(childNode, row.table, 1);
            }
        }

        parentNode.id = row.id;
        parentNode.rowId = row.rowId;
        return parentNode;
    }

    function generateUnionTree(rows) {
        var row = rows.shift,
            ids = row.table.match(/(\d+)/g),
            enclosingScope,
            tableNames,
            tree,
            node,
            kids = [];

        //SUBQUERY
        if (rows[0].select_type.match(/SUBQUERY/)) {
            enclosingScope = rows[0];
        }

        //doubtful about this foreach loop
        ids.forEach(function (elem, index) {
            var start = rows.indexOf(elem),
                end = index < ids.length - 1 ? rows.indexOf(ids[index + 1]) : rows.length - 1;
            kids.push(buildQueryPlan(rows.splice(start, end - start)));
        });

        row.children = kids;
        tableNames = kids.map(function (k) {
            return recursiveTableName(k) || "<none>";
        });
        row.table = "union(" + tableNames.join(",");
        tree = transformRowToNode(row);
        if (enclosingScope) {
            node = transformRowToNode(enclosingScope);
            node.children = [tree];
            tree = node;
        }
        return tree;
    }

    //generating tree
    function buildQueryPlan(rows) {
        var kids,
            enclosingScope,
            tree,
            derived,
            derivedId,
            first,
            isTempFilesort = false,
            firstExtra,
            filteredRow,
            start,
            end,
            scope,
            i = 0,
            r,
            firstNonConst;

        if (rows.length === 0) {
            return;
        }

        //UNION
        if (rows[0].select_type === "UNION RESULT") {
            tree = generateUnionTree(rows);
            return tree;
        }

        //DERIVED TABLES

        filteredRow = $.grep(rows, function (e) {
            var table = e.table;
            return table && table.match(/^<derived\d+>$/);
        })[0];
        while (filteredRow) {
            derivedId = queralyzer.customMatch(filteredRow.table, /^<derived(\d+)>$/);
            start = indexById(rows, derivedId);
            end = start;
            while (end < rows.length && rows[end].id >= derivedId) {
                end += 1;
            }

            enclosingScope = rows.splice(start, end - start);
            kids = buildQueryPlan(enclosingScope);
            filteredRow.children = [kids];
            filteredRow.table = "derived(" + (recursiveTableName(kids) || "<none>") + ")";
            filteredRow = $.grep(rows, function (e) {
                var table = e.table;
                return table && table.match(/^<derived\d+>$/);
            })[0];
        }

        //Filesort
        first = rows.shift();
        firstExtra = first.Extra;
        if (firstExtra.match(/Using temporary; Using filesort/)) {
            isTempFilesort = true;
            firstExtra.replace(/Using temporary; Using filesort(?:; )?/, "");
        } else if (firstExtra.match(/Using filesort/) && first.type.match(/^(?:system|const)$/)) {
            firstNonConst = $.grep(rows, function (elem) {
                return !elem.type.match(/^(?:system|const)$/);
            });
            if (firstNonConst) {
                firstExtra.replace(/Using filesort(?:; )?/, "");
                firstNonConst.Extra += "; Using filesort";
            }
        }
        scope = first.id;
        tree = transformRowToNode(first);
        while (i < rows.length) {
            r = rows[i];
            if (r.id === scope) {
                tree = {
                    type: "JOIN",
                    children: [tree, transformRowToNode(r)]
                };
                i += 1;
            } else {
                end = i;
                while (end < rows.length && rows[end].id >= r.id) {
                    end += 1;
                }
                enclosingScope = rows.splice(i, end - i);
                tree = {
                    type: r.select_type,
                    children: [tree, buildQueryPlan(enclosingScope)]
                };
            }
        }
        if (isTempFilesort) {
            tree = filesort(temporary(tree, recursiveTableName(tree)));
        }
        return tree;
    }


    function isDataCorrect(rows) {
        var newId;
        rows.forEach(function (row, index) {
            row.rowId = index;
            row.Extra = row.Extra || "";

            if (row.table && !row.table.match(/\./)) {
                if (!row.id && row.table.match(/^<union(\d+)/)) {
                    newId = queralyzer.customMatch(row.table, /^<union(\d+)/);
                    row.id = newId;
                } else {
                    return false; //"Unexpected NULL in id column, please report as a bug"
                }
            }
            return false; //"UNION has too many tables"
        });
        return true;
    }

    function reorderRows(rows) {

        var unionRows,
            unionForward,
            otherRows,
            lastId = 0,
            reordered = [];

        unionRows = $.grep(rows, function (r) {
            return r.select_type === "UNION RESULT";
        });

        unionForward = unionRows.map(function (r) {
            var a = {}, id = r.id;
            a[id] = r;
            return a;
        });

        otherRows = $.grep(rows, function (r) {
            return r.select_type !== "UNION RESULT";
        });

        otherRows.forEach(function (r) {
            var id = r.id;
            if (lastId !== id && unionForward[id]) {
                reordered.push(unionForward[id]);
            }
            reordered.push(r);
            lastId = id;
        });
        return reordered;
    }

    return {
        //main function
        generateTree:function(rows){
            var reordered,
                tree;
            if (isDataCorrect(rows)) {
                reordered = reorderRows(rows);
                tree = buildQueryPlan(reordered);
                return tree;
            }
        }
    }

})();


