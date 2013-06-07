/**
 * Created with IntelliJ IDEA.
 * User: shiti
 * Date: 6/7/13
 * Time: 12:04 PM
 * To change this template use File | Settings | File Templates.
 */
function TypeFactory() {

    function customMatch(source, pattern) {
        var result = source.match(pattern);
        if (result) {
            return result[1];
        }
        return false;
    }

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
            type = customMatch(row.table, /^(derived|union)\(/);
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

    // row type functions
    this.node_ALL = function (row) {
        return {
            type: 'Table scan',
            rows: row.rows,
            children: [table(row)]
        };
    };

    this.node_fulltext = function (row) {
        return indexAccess(row, "Fulltext scan");
    };

    this.node_range = function (row) {
        return indexAccess(row, "Index range scan");
    };

    this.node_index = function (row) {
        return indexAccess(row, "Index scan");
    };

    this.node_eq_ref = function (row) {
        return indexAccess(row, "Unique index lookup");
    };

    this.node_ref = function (row) {
        return indexAccess(row, "Index lookup");
    };

    this.node_ref_or_null = function (row) {
        return indexAccess(row, "Index lookup with extra null lookup");
    };

    this.node_const = function (row) {
        return indexAccess(row, "Constant index lookup");
    };

    this.node_system = function (row) {
        return {
            type: 'Constant table access',
            rows: row.rows,
            children: [table(row)]
        };
    };

    this.node_unique_subquery = function (row) {
        return indexAccess(row, "Unique subquery");
    };

    this.node_index_subquery = function (row) {
        return indexAccess(row, "Index subquery");
    };

    this.node_index_merge = function (row) {
        var merge,
            mergeSpec = row.Extra.match(/Using ((?:intersect|union|sort_union)\(.*?\))(?=;|$)/);

        merge = recursiveIndexMerge(row, mergeSpec[1], 0)[0];
        return bookmarkLookup(merge, row);
    };


}