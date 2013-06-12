/*global queralyzer,d3,$*/
queralyzer.App = (function () {

    "use strict";
    var tableData, indexData;

    function tabulate(container, data, columns) {
        var table = d3.select(container).append("table")
                .attr("class", "table table-condensed")
                .style("table-layout", "fixed"),
            tableHeader = table.append("thead"),
            tableBody = table.append("tbody").attr("class", "searchable"),
            rows,
            cells;

        tableHeader.append("tr")
            .selectAll("th")
            .data(columns)
            .enter()
            .append("th")
            .text(function (column) {
                return column.charAt(0).toUpperCase() + column.substr(1);
            });

        rows = tableBody.selectAll("tr")
            .data(data)
            .enter()
            .append("tr")
            .attr("id", function (d, index) {
                return index;
            });

        cells = rows.selectAll("td")
            .data(function (row) {
                return columns.map(function (column) {
                    return {column: column, value: row[column]};
                });
            })
            .enter()
            .append("td")
            .html(function (d) {
                return "<div class='" + d.column + "' contenteditable='false'>" + d.value + "</div>";
            });

    }

    function createTreeLayout(nodes) {
        $("#treeContainer").empty();
        d3.select("#treeContainer").selectAll("div")
            .data(nodes)
            .enter()
            .append("div")
            .style("margin-left", function (d) {
                return (d.depth * 10) + "px";
            })
            .style("display", function (d) {
                return displayType(d);
            })
            .style("word-wrap", "break-word")
            /*.attr("class", function (d) {
             var className = "";
             if (d.type === "Table scan") {
             className += "avoidableJoinType";
             return className;
             }
             })*/
            .attr("node", function (d) {
                return d.nodeId;
            })
            .html(function (d) {
                var icon = "",
                    content;
                if (d.isVisible && d.children && d.children[0].isVisible) {
                    icon = "<i class='icon-minus' ></i>";
                } else if (d.children) {
                    icon = "<i class='icon-plus'></i>";
                }

                if (d.type === "Table scan") {
                    icon += "<i class='icon-warning-sign'></i>";
                }
                content = icon + d.type + ((d.table) ? " " + d.table : "");

                return content;
            })
            .on("click", function (d) {
                if (d.children) {
                    d.children.forEach(function (elem) {
                        elem.isVisible = !elem.isVisible;
                    });
                }
                createTreeLayout(nodes);
            });
    }

    function displayType(element) {
        if (element.parent && !element.parent.isVisible) {
            element.isVisible = false;
        }
        if (!element.isVisible) {
            return "none";
        }
        return "block";
    }

    return {
        addTableMetadata: function (jsData) {
            var columns = ["name", "rows", "action"],
                data = [];
            tableData = jsData;
            $.each(jsData, function (index, d) {
                var a = {};
                a.name = d.tableName;
                a.rows = d.rowCount;
                a.action = "<i class='icon-edit'></i>";
                data.push(a);
            });
            tabulate("#tableMetadata", data, columns);
        },

        addIndexMetadata: function (jsData) {
            var columns = ["table", "type", "columns", "cardinality", "action"],
                data = [];
            indexData = jsData;
            jsData.forEach(function (d) {
                var a = {};
                a.table = d.tableName;
                a.type = d.indexType;
                a.cardinality = d.cardinality;
                a.columns = d.indexColumns;
                a.action = "<i class='icon-edit'></i>";
                data.push(a);
            });
            tabulate("#indexMetadata", data, columns);
        },

        updateTableMetaData: function (index, obj) {
            var tableData = tableData[index];
            tableData.tableName = obj.name;
            tableData.rowCount = obj.rows;
        },

        updateIndexMetaData: function (index, obj) {
            var indexData = indexData[index];
            indexData.tableName = obj.table;
            indexData.indexType = obj.type;
            indexData.cardinality = obj.cardinality;
            indexData.indexColumns = obj.columns;
        },
        renderTree: function (data) {
            var tree = d3.layout.tree()
                    .value(function (d, i) {
                        return i;
                    }),
                nodes = tree.nodes(data);

            nodes.forEach(function (elem) {
                elem.isVisible = true;
                if (elem.parent) {
                    elem.nodeId = elem.parent.nodeId + "." + (elem.parent.children.indexOf(elem) + 1);
                }
                else {
                    elem.nodeId = "1";
                }

            });
            createTreeLayout(nodes);
        }
    };

})();






