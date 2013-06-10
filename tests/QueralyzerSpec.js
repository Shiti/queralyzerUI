describe("QueralyzerSpec", function () {
    it("works for simple query", function () {
        var data = new queralyzer.dataObj();
        data.add(queralyzer.createPrimaryType("1", "user"));
        var result = queralyzer.ExplainTree.generateTree(data.value());
        expect(result).toBeDefined();
        expect(result.children[0].type).toBe("Table scan");
        expect(result.children[0].children[0].table).toBe("user");
    });

    it("works where table name is not given", function () {  //access_plan_3
        var data = new queralyzer.dataObj();
        data.add(queralyzer.createPrimaryType("1"));
        expect(queralyzer.ExplainTree.generateTree(data.value())).toBeDefined();

    });

    it("works for derived query", function () {
        var data = new queralyzer.dataObj();
        data.add(queralyzer.createDerivedType("3", ["b", "p", "ur"], "Using where; Using filesort"));
        data.add(queralyzer.createDerivedType("2", "<derived3>", "Using where"));
        data.add(queralyzer.createPrimaryType("1", "<derived2>", "NULL"));
        data.add(queralyzer.createPrimaryType("1", "<derived2>", "NULL"));

        var result = queralyzer.ExplainTree.generateTree(data.value());
        expect(result).toBeDefined();
        expect(result.type).toBe("JOIN");
        expect(result.children[0].id).toBe("1");
    });

    it("works for union query", function () {
        var data = [
            {
                "Extra": "NULL",
                "id": "1",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "20000",
                "select_type": "PRIMARY",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "2",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "actor_1",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "3",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "UNION",
                "table": "actor_2",
                "type": "ALL"
            },
            {
                "Extra": "Using temporary",
                "id": "NULL",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "NULL",
                "select_type": "UNION RESULT",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "4",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "20000",
                "select_type": "UNION",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "5",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "actor_3",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "6",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "UNION",
                "table": "actor_4",
                "type": "ALL"
            },
            {
                "Extra": "Using temporary",
                "id": "NULL",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "NULL",
                "select_type": "UNION RESULT",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "Using temporary",
                "id": "NULL",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "NULL",
                "select_type": "UNION RESULT",
                "table": "",
                "type": "ALL"
            }
        ];
        expect(queralyzer.ExplainTree.generateTree(data)).toBeDefined();

    });
});
