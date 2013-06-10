
queralyzer.App =(function(){

    "use strict";
    var tableData,indexData;

    function tabulate(container,data,columns) {

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

    }

    return {
        addTableMetadata: function(jsData){
        var columns =["name","rows","action"];
        tableData = jsData;
        var data = [];
        $.each(jsData,function(index,d){
            var a = {};
            a.name = d.tableName;
            a.rows = d.rowCount;
            a.action = "<i class='icon-edit'></i>";
            data.push(a);
        });
        tabulate("#tableMetadata",data,columns);
        },

        addIndexMetadata : function(jsData){
            var columns =["table","type","columns","cardinality","action"];
            indexData = jsData;
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
            tabulate("#indexMetadata",data,columns);
        },

        updateTableMetaData : function(index,obj){
            var tableData = tableData[index];
            tableData.tableName = obj.name;
            tableData.rowCount = obj.rows;
        },

        updateIndexMetaData : function(index,obj){
            var indexData = indexData[index];
            indexData.tableName = obj.table;
            indexData.indexType = obj.type;
            indexData.cardinality = obj.cardinality;
            indexData.indexColumns = obj.columns;
        },
        renderTree:  function(jsonData){
        d3.select("#treeContainer").selectAll("div")
            .data(jsonData)
            .enter()
            .append("div")
            .text(function(d){
                return d.id + " - " + d.Extra;
            });
        }
    }

})();





