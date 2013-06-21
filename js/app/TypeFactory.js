var queralyzer = {};

queralyzer.customMatch = function (source, pattern) {
    "use strict";
    var result = source.match(pattern);
    if (result) {
        return result[1];
    }
    return false;
};

queralyzer.toCamelCase = function (word) {
    "use strict";
    return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
}

queralyzer.TypeFactory = (function () {

    "use strict";

    //helper functions for type functions
    function recursiveIndexMerge(row, spec, num) {
        var matchedArray = spec.match(/(intersect|union|sort_union)\((.*)\)$/),
            type = matchedArray[1],
            args = matchedArray[2];
        //skipped --this uses a recursive pattern
    }

    function table(row) {
        var type = false,
            node;
        if (row.type) {
            type = queralyzer.customMatch(row.table, /^(derived|union)\(/);
        }
        node = {
            type: (row.type && type) ? type.toUpperCase() : "Table",
            table: row.table,
            possible_keys: row.possible_keys,
            partitions: row.partitions
        };
        if (row.children) {
            node.children = row.children;
        }
        return node;
    }

    function bookmarkLookup(node, row) {
        //skipped clustered key in if condition
        //(clustered && row.key && row.key === "PRIMARY")
        if (row.Extra.match(/Using index/)) {
            return node;
        }
        return {
            type: "Bookmark lookup",
            children: [node, table(row)]
        };
    }

    function indexAccess(row, type, key) {
        var node = {
            type: type,
            key: row.table + "->" + (key || row.key),
            possible_keys: row.possible_keys,
            partitions: row.partitions,
            key_len: row.key_len,
            ref: row.ref,
            rows: row.rows
        };

        if (row.Extra.match(/Full scan on NULL key/)) {
            node.warning = "Full scan on NULL key";
        }
        if (row.Extra.match(/Using index for group-by/)) {
            node.type = "Loose index scan";
        }
        if (row.type !== "index_merge") {
            node = bookmarkLookup(node, row);
        }
        return node;
    }

    return { // row type functions

        node_ALL: function (row) {
            return {
                type: 'Table scan',
                rows: row.rows,
                children: [table(row)]
            };
        },
        node_fulltext: function (row) {
            return indexAccess(row, "Fulltext scan");
        },
        node_range: function (row) {
            return indexAccess(row, "Index range scan");
        },

        node_index: function (row) {
            return indexAccess(row, "Index scan");
        },

        node_eq_ref: function (row) {
            return indexAccess(row, "Unique index lookup");
        },

        node_ref: function (row) {
            return indexAccess(row, "Index lookup");
        },

        node_ref_or_null: function (row) {
            return indexAccess(row, "Index lookup with extra null lookup");
        },

        node_const: function (row) {
            return indexAccess(row, "Constant index lookup");
        },

        node_system: function (row) {
            return {
                type: 'Constant table access',
                rows: row.rows,
                children: [table(row)]
            };
        },

        node_unique_subquery: function (row) {
            return indexAccess(row, "Unique subquery");
        },

        node_index_subquery: function (row) {
            return indexAccess(row, "Index subquery");
        },

        node_index_merge: function (row) {
            var merge,
                mergeSpec = row.Extra.match(/Using ((?:intersect|union|sort_union)\(.*?\))(?=;|$)/);

            merge = recursiveIndexMerge(row, mergeSpec[1], 0)[0];
            return bookmarkLookup(merge, row);
        }

    };
})();