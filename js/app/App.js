/*global queralyzer,d3,$*/
queralyzer.App = (function () {

    "use strict";
    var tableData,
        indexData,
        actualJsonData,
        treeDetails = {};

    // Create the XHR object.
    function createCORSRequest(method, url) {
        var xhr = new XMLHttpRequest();
        if ("withCredentials" in xhr) {
            // XHR for Chrome/Firefox/Opera/Safari.
            xhr.open(method, url, true);
        } else if (typeof XDomainRequest != "undefined") {
            // XDomainRequest for IE.
            xhr = new XDomainRequest();
            xhr.open(method, url);
        } else {
            // CORS not supported.
            xhr = null;
        }
        return xhr;
    }

    function tabulate(container, data, columns) {
        $(container).empty();

        var table = d3.select(container).append("table")
                .attr("class", "table table-condensed table-fixed-header")
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
            className = "leaves ",
            content,
            label = (node.id || "") + " " +
                node.type[0] + node.type.toLowerCase().substring(1) +
                ((node.table) ? " " + node.table : "");

        if (node.children && node.children.length > 0) {
            className += "collapsible";
            icon = "<i class='icon-plus'></i>";
        }
        if (node.isChildVisible) {
            icon = "<i class='icon-minus'></i>";
        }
        content = "<a class='" + className + "'>";
        if (node.type === "Table scan") {
            icon += "<i class='icon-warning-sign'></i>";
        }
        content += icon + label + "</a>";
        return content;
    }

    function click(node) {
        var parent,
            children;
        if (node.children && node.children.length > 0) {
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

    function removeExtraNodes(tree) {
        if (tree.children) {
            if (tree.children.length > 1) {
                return tree;
            }
            return removeExtraNodes(tree.children[0]);
        }
        return tree;
    }

    function updateFilterNode(node) {
        var child,
            grandChild;

        if (node.type === "Filter with WHERE") {
            child = node.children[0];
            grandChild = node.children[0].children[0];
            if (child.type === "Table scan" && grandChild.type === "Table") {
                node.type = "Filter on";
                node.table = grandChild.table;
                node.title = "Using WHERE";
                node.children = [];
            }
        } else if (node.type === "Bookmark lookup") {
            node = node.children[1];
        }
        return node;
    }

    function prettyPrint(tree) {
        var childNodes = [],
            child;

        if (tree.children) {

            tree.children.forEach(function (child) {
                if (child.type === "Bookmark lookup") {
                    tree.type += " using bookmark lookup";
                }
                childNodes.push(updateFilterNode(child));
            });
            tree.children = childNodes;


            if (tree.type === "Join buffer") {
                child = tree.children[0];
                if (child.type === "Filter on") {
                    tree = child;
                }
            }

            childNodes = [];
            tree.children.forEach(function (child) {
                childNodes.push(prettyPrint(child));
            });

            tree.children = childNodes;

            /* if (tree.children.length === 1) {
             tree = removeExtraNodes(tree);
             }*/
            //TODO change it from tooltip to a details thing
            tree.title = tree.title || JSON.stringify(actualJsonData[tree.rowId]);
            return tree;
        }
        return tree;
    }

    function analyze(tree) {
        if (tree.type === "DERIVED") {
            treeDetails.derived += 1;
        }
        if (tree.type === "Filesort") {
            treeDetails.fileSort += 1;
        }
        if (tree.type === "Table scan") {
            treeDetails.tableScan += 1;
        }
        if (tree.children) {
            tree.children.forEach(function (child) {
                analyze(child);
            });
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
            .attr("title", function (d) {
                return d.title;
            })
            .html(function (d) {
                return generateHtmlContent(d);
            })
            .on("click", function (d) {
                click(d);
            });
    }

    function renderRows() {
        var columns = ["id", "key", "key_len", "possible_keys", "ref", "rows",
            "select_type", "table", "type", "Extra"];
        tabulate("#rowContainer", actualJsonData, columns);
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
            var tree,
                cleanTree,
                treeFunction,
                nodes;

            actualJsonData = JSON.parse(JSON.stringify(data));
            tree = queralyzer.ExplainTree.generateTree(data);
            treeDetails = {derived: 0, tableScan: 0, fileSort: 0};

            /*analyze(data);
             console.log(treeDetails);*/

            cleanTree = removeExtraNodes(tree);
            prettyPrint(cleanTree);

            treeFunction = d3.layout.tree()
                .value(function (d, i) {
                    return i;
                });
            nodes = treeFunction.nodes(cleanTree);

            nodes.forEach(function (elem) {
                if (elem.children && elem.children.length > 0) {
                    elem.isChildVisible = true;
                }
                if (elem.parent) {
                    elem.nodeId = elem.parent.nodeId + "-" + (elem.parent.children.indexOf(elem) + 1);
                } else {
                    elem.nodeId = "1";
                }

            });
            createTreeLayout(nodes);
            renderRows();
        },
        submitQuery: function () {
            var data = $('form#queryForm').serialize();

            $.post('/query', data, function (result) {
                queralyzer.App.renderTree(result);
            }, 'json');

            $.getJSON('/tablemetadata', function (result) {
                queralyzer.App.addTableMetadata(result);
            });

            $.getJSON('/indexmetadata', function (result) {
                queralyzer.App.addIndexMetadata(result);
            });
        },
        logError: function (error) {
            var errorLog = {
                "title": "Found a bug",
                "body": error
            };

            $.ajax({
                type: 'POST',
                url: 'https://github.com/Shiti/queralyzerUI/issues',
                data: JSON.stringify(errorLog),
                xhrFields: {
                    withCredentials: true
                },
                crossDomain: true,
                success: function () {
                    alert("Logged the issue");
                },
                error: function (e) {
                    console.log(e);
                }
            });
        }
    };

})();






