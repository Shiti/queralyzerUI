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

    function generateHtmlContent(node) {
        var icon = "",
            content = "<a class='leaves'>";
        if (node.isChildVisible) {
            icon = "<i class='icon-minus'></i>";
        } else if (node.children) {
            icon = "<i class='icon-plus'></i>";
        }
        if (node.type === "Table scan") {
            icon += "<i class='icon-warning-sign'></i>";
        }
        content += icon + node.type + ((node.table) ? " " + node.table : "") + "</a>";
        return content;
    }

    function click(node) {
        var parent,
            children;
        if (node.children) {
            parent = $("div[node='" + node.nodeId + "']");
            children = $("div[node|='" + node.nodeId + "']");
            node.isChildVisible = !node.isChildVisible;

            if (node.isChildVisible) {
                children.show();
                children.find(".icon-plus").removeClass("icon-plus").addClass("icon-minus");
            } else {
                children.hide();
                parent.show();
                parent.find(".icon-minus").removeClass("icon-minus").addClass("icon-plus");
            }
        }
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
            .style("word-wrap", "break-word")
            .attr("node", function (d) {
                return d.nodeId;
            })
            .html(function (d) {
                return generateHtmlContent(d);
            })
            .on("click", function (d) {
                click(d);
            });
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
                if (elem.children) {
                    elem.isChildVisible = true;
                }
                if (elem.parent) {
                    elem.nodeId = elem.parent.nodeId + "-" + (elem.parent.children.indexOf(elem) + 1);
                } else {
                    elem.nodeId = "1";
                }

            });
            createTreeLayout(nodes);
        }
    };

})();






