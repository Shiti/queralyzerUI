/*global $*/
function ExplainTree(explainJsonOutput) {
    "use strict";

    var rowType = new TypeFactory();

    function customMatch(source, pattern) {
        var result = source.match(pattern);
        if (result.length > 1) {
            return result[1];
        }
        return false;
    }

    //helper functions

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
            return customMatch(node.key, /(.*?)->/);
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


    function filesort(node) {
        return {
            type: "Filesort",
            children: [node]
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


    function transform(row) {
        var sub = row.type,
            childNode,
            warn,
            funcName,
            parentNode = {},
            noMatchingRow = [
                "Impossible (?:WHERE|HAVING)(?: noticed after reading const tables)?",
                "No matching.*row",
                "(?:unique|const) row not found"].join("|");

        funcName = "node_" + sub;

        childNode = sub
            ? rowType[funcName](row) : row.Extra.match(/No tables/)
            ? { type: (!row.select_type.match(/^(?:PRIMARY|SIMPLE)$/) ? row.select_type : 'DUAL') }
            : row.Extra.match(new RegExp("(?:" + noMatchingRow + ")", "i"))
            ? { type: 'IMPOSSIBLE' } : row.Extra.match(/optimized away/)
            ? { type: 'CONSTANT' } : false;

        if (!childNode) {
            return;
        }

        warn = row.Extra.match(new RegExp(noMatchingRow));

        if (warn) {
            parentNode.warning = warn;
        }
        if (row.Extra.match(/Using where/)) {
            parentNode.type = "Filter with WHERE";
            parentNode.children = [childNode];
        }
        if (row.Extra.match(/Using join buffer/)) {
            parentNode.type = "Join buffer";
            parentNode.children = [childNode];
        }
        if (row.Extra.match(/Distinct|Not exists/)) {
            parentNode.type = "Distinct/Not-Exists";
            parentNode.children = [childNode];
        }
        if (row.Extra.match(/Range checked for each record \(\w+ map: ([^\)]+)\)/)) {
            /* Skipping possible keys for now*/
            parentNode = {
                type: 'Re-evaluate indexes each row',
                children: [childNode]
            };
        }
        if (row.Extra.match(/Using filesort/)) {
            parentNode = filesort(childNode);
        }
        if (row.Extra.match(/Using temporary/)) {
            parentNode = temporary(childNode, row.table, 1);
        }

        parentNode.id = row.id;
        parentNode.rowId = row.rowId;
        return parentNode;
    }

    //generating tree
    function buildQueryPlan(rows) {
        var row,
            kids,
            ids = [],
            enclosingScope,
            tableNames = [],
            tree,
            node,
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
            row = rows.shift;
            ids = row.table.match(/(\d+)/g);

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
            tree = transform(row);
            if (enclosingScope) {
                node = transform(enclosingScope);
                node.children = [tree];
                tree = node;
            }
            return tree;
        }

        //DERIVED TABLES

        filteredRow = $.grep(rows, function (e) {
            var table = e.table;
            return table && table.match(/^<derived\d+>$/);
        })[0];
        while (filteredRow) {
            derivedId = customMatch(filteredRow.table, /^<derived(\d+)>$/);
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
        tree = transform(first);
        while (i < rows.length) {
            r = rows[i];
            if (r.id === scope) {
                tree = {
                    type: "JOIN",
                    children: [tree, transform(r)]
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

    //main function
    function process(rows) {
        var lastId = 0,
            reordered = [],
            tree,
            unionRows,
            otherRows,
            unionForward;
        rows.forEach(function (r, index) {
            r.rowId = index;
            r.Extra = r.Extra || "";

            if (r.table && !r.table.match(/\./)) {
                if (!r.id && r.table.match(/^<union(\d+)/)) {
                    var newId = customMatch(r.table, /^<union(\d+)/);
                    r.id = newId;
                } else {
                    return; //"Unexpected NULL in id column, please report as a bug";
                }
            }
            return;// "UNION has too many tables:" + r.table;
        });


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

        tree = buildQueryPlan(reordered);
        return tree;
    }

    console.log(process(explainJsonOutput));

}


