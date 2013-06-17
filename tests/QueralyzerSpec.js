/*global queralyzer,describe,it,expect*/
describe("QueralyzerSpec", function () {
    it("works for simple query", function () {
        var data = new queralyzer.dataObj(),
            result;
        data.add(queralyzer.createPrimaryType("1", "user"));
        result = queralyzer.ExplainTree.generateTree(data.value());
        expect(result).toBeDefined();
        expect(result.children[0].type).toBe("Table");
    });

    it("works where table name is not given", function () {
        var data = new queralyzer.dataObj(),
            result;
        data.add(queralyzer.createPrimaryType("1", "", "Using where; Using filesort"));
        data.add(queralyzer.createDerivedType("2", "", "Using where; Using filesort"));
        result = queralyzer.ExplainTree.generateTree(data.value());
        expect(result).toBeDefined();
        expect(result.type).toBe("DERIVED");
        expect(result.children[1].type).toBe("Filter with WHERE");
    });

    it("works for derived query", function () {
        var data = new queralyzer.dataObj(),
            result;
        data.add(queralyzer.createDerivedType("3", ["b", "p", "ur"], "Using where; Using filesort"));
        data.add(queralyzer.createDerivedType("2", "<derived3>", "Using where"));
        data.add(queralyzer.createPrimaryType("1", "<derived2>", "NULL"));
        data.add(queralyzer.createPrimaryType("1", "<derived2>", "NULL"));

        result = queralyzer.ExplainTree.generateTree(data.value());
        expect(result).toBeDefined();
        expect(result.type).toBe("JOIN");
        expect(result.children[1].children[0].type).toBe("DERIVED");
    });

    it("works for union query", function () {
        var data = new queralyzer.dataObj(),
            result;
        data.add(queralyzer.createPrimaryType("1"));
        data.add(queralyzer.createDerivedType("2", "actor_1"));
        data.add(queralyzer.createUnionType("3"));
        data.add(queralyzer.createUnionResultType("", "", "Using temporary"));
        data.add(queralyzer.createUnionType("4", "", "NULL"));
        result = queralyzer.ExplainTree.generateTree(data.value());
        expect(result).toBeDefined();
        expect(result.type).toBe("DERIVED");
        expect(result.children[1].type).toBe("UNION");
    });
});
