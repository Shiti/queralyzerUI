/*global queralyzer,d3,$*/
queralyzer.App = (function () {

    "use strict";
    var tableData,
        indexData,
        actualJsonData,
        treeDetails = {};

    function tabulate(container, data, columns, isSearchable) {
        $(container).empty();

        var table = d3.select(container).append("table")
                .attr("class", "table table-condensed")
                .style("table-layout", "fixed"),
            tableHeader = table.append("thead"),
            tableBody = table.append("tbody"),
            rows,
            cells;

        if (isSearchable) {
            tableBody.attr("class", "searchable");
        }

        tableHeader.append("tr")
            .selectAll("th")
            .data(columns)
            .enter()
            .append("th")
            .text(function (column) {
                return queralyzer.toCamelCase(column);
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
                var cellData = "<div class='" + d.column + "' contenteditable='false'>";
                if (d.value && (d.column === "table" || d.column === "possible_keys" || d.column === "key")) {
                    cellData += d.value.replace(/</, "&lt;").replace(/>/, "&gt;");
                } else {
                    cellData += (d.value || "NULL");
                }
                cellData += "</div>";
                return cellData;
            });

    }

    function generateHtmlContent(node) {
        var icon = "",
            className = "leaves ",
            content,
            label = (node.id || "") + " ";

        if (node.type) {
            label += queralyzer.toCamelCase(node.type);
        }

        if (node.children && node.children.length > 0) {
            className += "collapsible";
            icon = "<i class='icon-plus'></i>";
        }
        if (node.isChildVisible) {
            icon = "<i class='icon-minus'></i>";
        }
        if (node.type === "Table scan") {
            icon += "<i class='icon-warning-sign'></i>";
        }
        content = "<a class='" + className + "'>";
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

    function getActualTree(tree) {
        var child;
        if (tree.children) {
            child = tree.children;
            if (child.length > 1) {
                return tree;
            }
            if (child.length === 1) {
                if ((!child[0].children) || (child[0].children.length === 0)) {
                    return tree.children;
                }
                return getActualTree(tree.children[0]);
            }
        }
        return tree;
    }

    function updateLastNode(node) {
        var child,
            id,
            grandChild;

        id = node.id;
        if (node.type === "Filter with WHERE") {
            child = node.children[0];
            grandChild = node.children[0].children[0];
            if (child.type === "Table scan" && grandChild.type === "Table") {
                node = {
                    type: "Filter on " + grandChild.table,
                    title: "Using WHERE"
                };
            } else {
                node = child;
            }

        } else if (node.type === "Table scan" && node.children[0].type === "Table") {
            node = {type: node.children[0].table};
        }
        node.id = id;
        return node;
    }

    function update(tree) {
        var childNodes = [],
            updatedChild,
            id = tree.id;

        tree = updateLastNode(tree);

        if (tree.children) {

            tree.children.forEach(function (child) {
                childNodes.push(updateLastNode(child));
            });
            tree.children = childNodes;

            if (tree.children) {
                childNodes = [];
                tree.children.forEach(function (child) {
                    updatedChild = update(child);
                    childNodes.push(updatedChild);
                });
                tree.children = childNodes;
            }

            tree.id = id;
            return tree;
        }
        tree.id = id;
        return tree;
    }

    function prettyPrint(tree) {
        var children,
            grandChild,
            bookmarkType,
            childNodes = [],
            id = tree.id;
        if (tree.children) {
            children = tree.children;
            if (children.length === 1) {
                if (tree.type === "Distinct/not-exists") {
                    return tree;
                }
                if (children[0].id) {
                    id = children[0].id;
                }
                tree = prettyPrint(children[0]);
                tree.id = id;
                return tree;
            }
            if (children[1].type === "Bookmark lookup") {
                grandChild = children[1].children;
                bookmarkType = grandChild.shift();
                tree.type += " using bookmark lookup(" + bookmarkType.type + ")";
            }

            if (tree.type === "Bookmark lookup") {
                tree = children[1];
            }
            children.forEach(function (child) {
                childNodes.push(prettyPrint(child));
            });
            tree.children = childNodes;
            tree.id = id;
            return tree;
        }
        tree.id = id;
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
        tabulate("#rowContainer", actualJsonData, columns, false);
    }

    function clearContainers() {
        $("#userQuery").val("");
        $("#treeContainer").empty();
        $("#tableMetadata").empty();
        $("#indexMetadata").empty();
    }

    function updateTableMetaData(index, obj) {
        var selectedTable = tableData[index];
        selectedTable.rowCount = obj.rows;

        $.ajax({
            type: "POST",
            url: "/tablemetadata",
            data: encodeURI("tablemetadata=" + JSON.stringify(tableData)),
            error: function (e) {
                alert(e.responseText);
            }
        });
    }

    function updateIndexMetaData(index, obj) {
        var selectedIndex = indexData[index];

        selectedIndex.indexType = obj.type;
        selectedIndex.cardinality = obj.cardinality;
        selectedIndex.indexColumns = obj.columns;

        $.ajax({
            type: "POST",
            url: "/indexmetadata",
            data: encodeURI("indexmetadata=" + JSON.stringify(indexData)),
            success: function (result) {
                queralyzer.App.renderTree(result);
            },
            error: function (e) {
                alert(e.responseText);
            }
        });
    }

    function logError(error) {
        var errorLog = {
            "title": "Found a bug",
            "body": error
        };

        $.ajax({
            type: 'POST',
            url: 'https://github.com/repos/Shiti/queralyzerUI/issues',
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

    return {
        renderTableMetaData: function (jsData) {
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
            tabulate("#tableMetadata", data, columns, true);
        },

        renderIndexMetaData: function (jsData) {
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
            tabulate("#indexMetadata", data, columns, true);
        },

        renderTree: function (explainJsonData) {
            var tree,
                cleanTree,
                treeFunction,
                nodes;

            actualJsonData = JSON.parse(JSON.stringify(explainJsonData));
            renderRows();

            tree = queralyzer.ExplainTree.generateTree(explainJsonData);
            treeDetails = {derived: 0, tableScan: 0, fileSort: 0};

            cleanTree = tree;

            if (actualJsonData.length > 1) {
                cleanTree = getActualTree(tree);
                update(cleanTree);
                prettyPrint(cleanTree);
            }
            treeFunction = d3.layout.tree()
                .value(function (d, i) {
                    return i;
                });
            nodes = treeFunction.nodes(cleanTree);

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
        },
        submitQuery: function () {
            var data = $('form#queryForm').serialize().replace(/%0D%0A/g, "");

            $.ajax({
                type: "POST",
                url: "/query",
                data: data,
                dataType: "json",
                success: function (result) {
                    queralyzer.App.renderTree(result);
                },
                error: function (e) {
                    alert(e.responseText);
                }
            });

            $.ajax({
                type: "GET",
                url: "/tablemetadata",
                dataType: "json",
                success: function (result) {
                    queralyzer.App.renderTableMetaData(result);
                },
                error: function (e) {
                    alert(e.responseText);
                }
            });

            $.ajax({
                type: "GET",
                url: "/indexmetadata",
                dataType: "json",
                success: function (result) {
                    queralyzer.App.renderIndexMetaData(result);
                },
                error: function (e) {
                    if (e.status === 501) {
                        $("#indexMetadata").html(e.responseText);
                    } else {
                        alert(e.responseText);
                    }
                }
            });

        },
        reset: function () {
            $.ajax({
                type: 'POST',
                url: '/reset',
                success: function () {
                    clearContainers();
                },
                error: function (e) {
                    alert(e.responseText);
                }

            });
        },
        enableEditing: function (iconElem) {
            var row = iconElem.closest("tr");

            iconElem.removeClass("icon-edit");
            iconElem.addClass("icon-save");

            row.find("div").each(function (index, elem) {
                var element = $(elem);
                if (!(element.hasClass("action") || element.hasClass("name") || element.hasClass("table"))) {
                    element.attr("contenteditable", true);
                }
            });
        },
        saveChanges: function (iconElem) {
            var newData = {},
                row = iconElem.closest("tr"),
                rowId = row.attr("id"),
                tableContainer = iconElem.closest("table").parent(),
                containerId = tableContainer.attr("id");

            iconElem.removeClass("icon-save");
            iconElem.addClass("icon-edit");

            row.find("div").each(function (index, elem) {
                var element = $(elem);
                if (!element.hasClass("action")) {
                    newData[element.attr("class")] = element.text();
                    element.attr("contenteditable", false);
                }
            });

            if (containerId === "tableMetadata") {
                updateTableMetaData(rowId, newData);
            } else {
                updateIndexMetaData(rowId, newData);
            }

        },
        filterRows: function (text) {
            var regex = new RegExp(text, 'i');
            $('.searchable tr').hide();
            $('.searchable tr').filter(function () {
                return regex.test($(this).text());
            }).show();
        }

    };

})();






