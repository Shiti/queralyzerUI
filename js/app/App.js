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

    function removeExtraNodes(tree) {
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
                return removeExtraNodes(tree.children[0]);
            }
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
                node = {
                    type: "Filter on " + grandChild.table,
                    title: "Using WHERE"
                };
            } else {
                node = child;
            }

        } else if (node.type === "Bookmark lookup") {
            node = node.children[1];
        } else if (node.type === "Table scan" && node.children[0].type === "Table") {
            node = {type: node.children[0].table};
        } else if (node.type === "Table scan") {
            node = node.children[0];
        }

        return node;
    }

    function updateFilesortNode(node) {
        var child = node.children[0];
        if (node.type === "Filesort") {
            if (child.type === "TEMPORARY") {
                return child.children[0];
            }
        }
        return node;
    }

    function prettyPrint(tree) {
        var childNodes = [],
            updatedChild,
            id = tree.id,
            child;

        tree = updateFilterNode(tree);

        if (tree.type === "Table scan") {
            tree = tree.children[0];
        }
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
                if (child.type.match(/Filter on [A-Za-z0-9_]+/)) {
                    tree = child;
                }
            }

            if (tree.type === "DERIVED") {
                tree = updateFilesortNode(tree.children[0]);
            }

            if (tree.children) {
                childNodes = [];
                tree.children.forEach(function (child) {
                    updatedChild = prettyPrint(child);
                    childNodes.push(updatedChild);
                });
                tree.children = childNodes;
            }

            //TODO change it from tooltip to a details thing
            tree.title = tree.title || JSON.stringify(actualJsonData[tree.rowId]);
            tree.id = id;
            return tree;
        }
        tree.id = id;
        return tree;
    }

    function prettyPrintUnion(tree) {
        var childNodes = [],
            updatedChild,
            id = tree.id;

        if (tree.children) {
            childNodes = [];
            tree.children.forEach(function (child) {
                if (child.type === "UNION") {
                    updatedChild = prettyPrintUnion(child);
                } else {
                    updatedChild = prettyPrint(child);
                }
                childNodes.push(updatedChild);
            });
            tree.children = childNodes;
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

    function postData(dataToSend, url) {
        $.ajax({
            type: "POST",
            url: "/" + url,
            data: encodeURI(url + "=" + JSON.stringify(dataToSend)),
            error: function (e) {
                alert(e.responseText);
            }
        });
    }

    function updateTableMetaData(index, obj) {
        var selectedTable = tableData[index];
        selectedTable.rowCount = obj.rows;
        postData(tableData, "tablemetadata");
    }

    function updateIndexMetaData(index, obj) {
        var selectedIndex = indexData[index];

        selectedIndex.indexType = obj.type;
        selectedIndex.cardinality = obj.cardinality;
        selectedIndex.indexColumns = obj.columns;

        postData(indexData, "indexmetadata");
    }

    function logError(error) {
        var errorLog = {
            "title": "Found a bug",
            "body": error
        };

        $.ajax({
            type: 'POST',
            url: '//github.com/repos/Shiti/queralyzerUI/issues',
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

            cleanTree = removeExtraNodes(tree);
            if (cleanTree.type === "UNION") {
                prettyPrintUnion(cleanTree);
            } else {
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
            var data = $('form#queryForm').serialize().replace("/n", "");

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






