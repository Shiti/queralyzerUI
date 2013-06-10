describe("QueralyzerSpec", function () {
    it("works for simple query", function () {
        var data = [{
            "Extra": "",
            "id": "1",
            "key": "NULL",
            "key_len": "NULL",
            "possible_keys": "NULL",
            "ref": "NULL",
            "rows": "2",
            "select_type": "SIMPLE",
            "table": "user",
            "type": "ALL"
        }];
        expect(queralyzer.ExplainTree.generateTree(data)).toBeDefined();
    });

    it("works where table name is not given", function () {  //access_plan_3
        var data = [
            {
                "Extra": "Using where; Using filesort",
                "id": "1",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000000000000",
                "select_type": "PRIMARY",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "1",
                "key": "",
                "key_len": "5",
                "possible_keys": "",
                "ref": "total_awarded.id",
                "rows": "10",
                "select_type": "PRIMARY",
                "table": "",
                "type": "ref"
            },
            {
                "Extra": "Using where",
                "id": "5",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "1000000000000",
                "select_type": "DERIVED",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "5",
                "key": "",
                "key_len": "5",
                "possible_keys": "",
                "ref": "current_table.id",
                "rows": "10",
                "select_type": "DERIVED",
                "table": "",
                "type": "ref"
            },
            {
                "Extra": "Using temporary; Using filesort",
                "id": "8",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "1000000000000",
                "select_type": "DERIVED",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using temporary",
                "id": "9",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "9",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "b",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Distinct; Using join buffer (Block Nested Loop)",
                "id": "9",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "ur",
                "type": "ALL"
            },
            {
                "Extra": "Using temporary; Using filesort",
                "id": "6",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "1000000000000",
                "select_type": "DERIVED",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using temporary",
                "id": "7",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "7",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "b",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Distinct; Using join buffer (Block Nested Loop)",
                "id": "7",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "ur",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using filesort",
                "id": "2",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "1000000000000",
                "select_type": "DERIVED",
                "table": "",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "2",
                "key": "",
                "key_len": "5",
                "possible_keys": "",
                "ref": "current_table.id",
                "rows": "10",
                "select_type": "DERIVED",
                "table": "",
                "type": "ref"
            },
            {
                "Extra": "Using where; Using temporary; Using filesort",
                "id": "4",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "b",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "4",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "ur",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "4",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using temporary; Using filesort",
                "id": "3",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "b",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "3",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "ur",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "3",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            }
        ];

        expect(queralyzer.ExplainTree.generateTree(data)).toBeDefined();

    });

    it("works for union query", function () { //access_plan_2
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

    it("works for derived query", function () {     //access_plan_1
        var data = [
            {
                "Extra": "Using where; Using temporary; Using filesort",
                "id": "1",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "1000000000",
                "select_type": "PRIMARY",
                "table": "<derived5>",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "1",
                "key": "<auto_key0>",
                "key_len": "5",
                "possible_keys": "<auto_key0>",
                "ref": "guests_exposed.id",
                "rows": "10000",
                "select_type": "PRIMARY",
                "table": "<derived2>",
                "type": "ref"
            },
            {
                "Extra": "Using where; Using filesort",
                "id": "5",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "100000000",
                "select_type": "DERIVED",
                "table": "<derived6>",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "5",
                "key": "<auto_key0>",
                "key_len": "5",
                "possible_keys": "<auto_key0>",
                "ref": "current_table.id",
                "rows": "10",
                "select_type": "DERIVED",
                "table": "<derived7>",
                "type": "ref"
            },
            {
                "Extra": "Using where; Using temporary; Using filesort",
                "id": "7",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "7",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "e",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using temporary; Using filesort",
                "id": "6",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "6",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "e",
                "type": "ALL"
            },
            {
                "Extra": "Using where",
                "id": "2",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "1000000000000",
                "select_type": "DERIVED",
                "table": "<derived3>",
                "type": "ALL"
            },
            {
                "Extra": "NULL",
                "id": "2",
                "key": "<auto_key0>",
                "key_len": "5",
                "possible_keys": "<auto_key0>",
                "ref": "current_table.id",
                "rows": "10",
                "select_type": "DERIVED",
                "table": "<derived4>",
                "type": "ref"
            },
            {
                "Extra": "Using where; Using temporary; Using filesort",
                "id": "4",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "b",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "4",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "4",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "ur",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using temporary; Using filesort",
                "id": "3",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "b",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "3",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "p",
                "type": "ALL"
            },
            {
                "Extra": "Using where; Using join buffer (Block Nested Loop)",
                "id": "3",
                "key": "NULL",
                "key_len": "NULL",
                "possible_keys": "NULL",
                "ref": "NULL",
                "rows": "10000",
                "select_type": "DERIVED",
                "table": "ur",
                "type": "ALL"
            }
        ];
        expect(queralyzer.ExplainTree.generateTree(data)).toBeDefined();

    });


});
