var queralyzer = new Object();

queralyzer.renderTree =  function(jsonData){
    d3.select("#treeContainer").selectAll("div")
        .data(jsonData)
        .enter()
        .append("div")
        .text(function(d){
            return d.id + " - " + d.Extra;
        });
};
queralyzer.tabulate=function(container,data,columns) {

    var table = d3.select(container).append("table")
            .attr("class", "table table-condensed")
            .style("table-layout","fixed"),
        thead = table.append("thead"),
        tbody = table.append("tbody").attr("class","searchable");

    thead.append("tr")
        .selectAll("th")
        .data(columns)
        .enter()
        .append("th")
        .text(function(column) {
            return column.charAt(0).toUpperCase() + column.substr(1);
        });

    var rows = tbody.selectAll("tr")
        .data(data)
        .enter()
        .append("tr")
        .attr("id",function(d,index){
            return index;
        });

    var cells = rows.selectAll("td")
        .data(function(row) {
            return columns.map(function(column) {
                return {column: column, value: row[column]};
            });
        })
        .enter()
        .append("td")
        .html(function(d) {
            return "<div class='"+ d.column +"' contenteditable='false'>"+d.value+"</div>";
        });

};

queralyzer.addTableMetadata = function(jsData){
    var columns =["name","rows","action"];
       queralyzer.tableData = jsData;
       var data = [];
       $.each(jsData,function(index,d){
        var a = {};
           a.name = d.tableName;
           a.rows = d.rowCount;
           a.action = "<i class='icon-edit'></i>";
           data.push(a);
       });
       queralyzer.tabulate("#tableMetadata",data,columns);
};

queralyzer.addIndexMetadata = function(jsData){
    var columns =["table","type","columns","cardinality","action"];
        queralyzer.indexData = jsData;
       var data = [];
       jsData.forEach(function(d){
        var a = {};
           a.table = d.tableName;
           a.type = d.indexType;
           a.cardinality = d.cardinality;
           a.columns = d.indexColumns;
           a.action = "<i class='icon-edit'></i>";
           data.push(a);
       });
        queralyzer.tabulate("#indexMetadata",data,columns);
}

queralyzer.updateTableMetaData = function(index,obj){
    var tableData = this.tableData[index];
    tableData.tableName = obj.name;
    tableData.rowCount = obj.rows;
}

queralyzer.updateIndexMetaData = function(index,obj){
    var indexData = this.indexData[index];
    indexData.tableName = obj.table;
    indexData.indexType = obj.type;
    indexData.cardinality = obj.cardinality;
    indexData.indexColumns = obj.columns;
}


