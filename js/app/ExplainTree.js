/*global $*/
queralyzer.ExplainTree = (function () {
    "use strict";

    function indexById(arr, id) {
        var i = 0,
            r,
            row;
        for (r = 0; r < arr.length; r++) {
            row = arr[r];
            if (row.id && row.id !== id) {
                i += 1;
            } else {
                break;
            }
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
        var node,
            finalNode;
        node = {
            type: "TEMPORARY",
            table: "temporary(" + tableName + ")",
            possible_keys: undefined,
            partitions: undefined,
            children: [childNode]
        };
        if (isScan) {
            finalNode = {
                type: "Table scan",
                rows: undefined,
                children: [node]
            };
        } else {
            finalNode = node;
        }

        return finalNode;
    }

    function createNode(type, children) {
        return {type: type, children: [children]};
    }

    function transformRowToNode(row) {
        var sub = row.type,
            node,
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
        node = sub
            ? queralyzer.TypeFactory[funcName](row) : extra.match(/No tables/)
            ? { type: (!row.select_type.match(/^(?:PRIMARY|SIMPLE)$/) ? row.select_type : 'DUAL') }
            : extra.match(new RegExp("(?:" + noMatchingRow + ")", "i"))
            ? { type: 'IMPOSSIBLE' } : extra.match(/optimized away/)
            ? { type: 'CONSTANT' } : false;

        if (!node) {
            return;
        }

        warn = extra.match(new RegExp(noMatchingRow));

        if (warn) {
            parentNode.warning = warn;
        }
        parentNode = node;
        if (extra.match(/Using where/)) {
            parentNode = createNode("Filter with WHERE", node);
            node = parentNode;
        }
        if (extra.match(/Using join buffer/)) {
            parentNode = createNode("Join buffer", node);
            node = parentNode;
        }
        if (extra.match(/Distinct|Not exists/)) {
            parentNode = createNode("Distinct/Not-Exists", node);
            node = parentNode;
        }
        if (extra.match(/Range checked for each record \(\w+ map: ([^\)]+)\)/)) {
            /* Skipping possible keys for now*/
            parentNode = createNode("Re-evaluate indexes each row", node);
            node = parentNode;
        }
        if (extra.match(/Using filesort/)) {
            parentNode = filesort(node);
        }
        if (extra.match(/Using temporary/)) {
            parentNode = temporary(node, row.table, 1);
        }

        parentNode.id = row.id;
        parentNode.rowId = row.rowId;
        return parentNode;
    }

    function generateUnionNode(rows) {
        var row = rows.shift(),
            ids = row.table.match(/(\d+)/g),
            i,
            start,
            end,
            enclosingScope,
            tableNames,
            tree,
            node,
            childTree,
            kids = [];

        //SUBQUERY
        if (rows.length > 0 && rows[0].select_type.match(/SUBQUERY/)) {
            enclosingScope = rows[0];
        }

        for (i = 0; i <= ids[0]; i++) {
            start = indexById(rows, ids[i]);
            end = (i < ids.length) ? indexById(rows, ids[i + 1]) : rows.length;
            childTree = buildQueryPlan(rows.splice(start, end - start));
            if (childTree) {
                kids.push(childTree);
            }
        }

        row.children = kids;
        tableNames = kids.map(function (k) {
            return recursiveTableName(k) || "<none>";
        });
        row.table = "union(" + tableNames.join(",") + ")";
        tree = transformRowToNode(row);
        if (enclosingScope) {
            node = transformRowToNode(enclosingScope);
            node.children = [tree];
            tree = node;
        }
        return tree;
    }

    function generateDerivedNode(rows) {
        var filteredRow,
            derivedId,
            start,
            end,
            enclosingScope,
            kids;

        filteredRow = $.grep(rows, function (e) {
            var table = e.table;
            return table && table.match(/^<derived\d+>$/);
        })[0];

        while (filteredRow) {
            derivedId = queralyzer.customMatch(filteredRow.table, /^<derived(\d+)>$/);
            start = indexById(rows, derivedId);
            end = start;
            while (end < rows.length && Number(rows[end].id) >= Number(derivedId)) {
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
    }

    //generating tree
    function buildQueryPlan(rows) {
        var enclosingScope,
            existingTree = {},
            newTree = {},
            first,
            isTempFilesort = false,
            firstExtra,
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
            existingTree = generateUnionNode(rows);
            return existingTree;
        }

        //DERIVED TABLES
        generateDerivedNode(rows);

        //Filesort
        first = rows.shift();
        firstExtra = first.Extra;
        if (firstExtra.match(/Using temporary; Using filesort/)) {
            isTempFilesort = true;
            first.Extra = firstExtra.replace(/Using temporary; Using filesort(?:; )?/, "");
        } else if (firstExtra.match(/Using filesort/) && first.type.match(/^(?:system|const)$/)) {
            firstNonConst = $.grep(rows, function (elem) {
                return !elem.type.match(/^(?:system|const)$/);
            });
            if (firstNonConst) {
                first.Extra = firstExtra.replace(/Using filesort(?:; )?/, "");
                firstNonConst.Extra += "; Using filesort";
            }
        }
        scope = first.id;
        existingTree = transformRowToNode(first);

        newTree = existingTree;
        while (i < rows.length) {
            r = rows[i];
            if (r.id === scope) {
                newTree = {type: "JOIN",
                    children: [existingTree, (transformRowToNode(r))]};
                i += 1;
                existingTree = newTree;
            } else {
                end = i;
                while (end < rows.length && Number(rows[end].id) >= Number(r.id)) {
                    end += 1;
                }
                enclosingScope = rows.splice(i, end - i);
                newTree = {
                    type: r.select_type,
                    children: [existingTree, (buildQueryPlan(enclosingScope))]
                };
            }

        }

        if (isTempFilesort) {
            newTree = filesort(temporary(existingTree, recursiveTableName(existingTree)));
        }
        return newTree;
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
            unionForward = {},
            otherRows,
            lastId = 0,
            reordered = [];

        unionRows = $.grep(rows, function (r) {
            return r.select_type === "UNION RESULT";
        });

        unionRows.forEach(function (r) {
            unionForward[r.id] = r;
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
        generateTree: function (rows) {
            var reordered,
                tree;
            if (isDataCorrect(rows)) {
                reordered = reorderRows(rows);
                tree = buildQueryPlan(reordered);
                return tree;
            }
        }
    };

})();


