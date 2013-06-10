queralyzer.createPrimaryType = function (id, table, extra) {
    var result = [],
        base = {
            Extra: extra || "",
            id: id || "NULL",
            select_type: "PRIMARY",
            type: "ALL",
            key: "NULL",
            key_len: "NULL",
            possible_keys: "NULL",
            ref: "NULL",
            rows: "10"
        };
    if (typeof table !== "String" && Array.isArray(table)) {
        table.forEach(function (elem) {
            var b = $.extend({}, base,{table:elem});
            result.push(b);
        });
    }
    else {
        base.table= table || "";
        result.push(base);
    }
    return result;
}

queralyzer.createDerivedType = function (id, table, extra) {
    var row = queralyzer.createPrimaryType(id, table, extra);
    row.select_type = "DERIVED";
    return row;
}

queralyzer.dataObj = function () {
    var data = [];
    return{
        add: function (arr) {
            arr.forEach(function (elem) {
                data.push(elem);
            });
        },
        value: function () {
            return data;
        }
    }
};
