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
    row.forEach(function(elem){
      elem.select_type = "DERIVED";
    });
    return row;
}

queralyzer.createSimpleType = function (id, table, extra) {
    var row = queralyzer.createPrimaryType(id, table, extra);
    row.forEach(function(elem){
        elem.select_type = "SIMPLE";
    });
    return row;
}

queralyzer.createUnionType = function (id, table, extra){
    var row = queralyzer.createPrimaryType(id, table, extra);
    row.forEach(function(elem){
        elem.select_type = "UNION";
    });
    return row;
}

queralyzer.createUnionResultType = function (id, table, extra){
    var row = queralyzer.createPrimaryType(id, table, extra);
    row.forEach(function(elem){
        elem.select_type = "UNION RESULT";
    });
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
