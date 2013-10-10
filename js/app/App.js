/*global queralyzer,d3,$,alert, document*/
queralyzer.App = (function () {

    "use strict";
    var tableData,
        indexData,
        actualJsonData,
        treeDetails = {},
        selectedIndexData;

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
            label = " ";

        if (node.type) {
            if ((node.type !== "JOIN" && node.type !== "UNION") && (node.type === node.type.replace(/\s/g, '') ||
                node.type.match(/Filter on/))) {
                label += node.type;
            } else {
                label += queralyzer.toCamelCase(node.type);
            }
        }

        label += (node.id) ? " <sup>[" + node.id + "]</sup>" : "";

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
            position = 0,
            grandChild,
            tableName;
        id = node.id;
        if (node.type === "Filter with WHERE") {
            child = node.children[0];
            if (child.children) {
                grandChild = node.children[0].children[0];
            }
            if (child.type === "Table scan" && grandChild.type === "Table") {
                node = {
                    type: "Filter on " + grandChild.table,
                    title: "Using WHERE"
                };
            } else if (child.type === "Index range scan") {
                position = child.key.indexOf("->");
                node = {
                    type: "Filter on " + child.key.substring(0, position) + "(" + child.key.substring(position + 2) + ")",
                    title: "Using WHERE"
                };
            } else {
                node = child;
            }

        } else if (node.type === "Table scan" && node.children[0].type === "Table") {
            node = {type: node.children[0].table};
        } else if (node.type === "Index lookup" || node.type === "Index scan" || node.type === "Unique index lookup" || node.type === "Constant index lookup") {
            position = node.key.indexOf("->");
            node.children = [
                {type: node.key.substring(0, position) + "(" + node.key.substring(position + 2) + ")"}
            ];
        } else if ((node.type === "Bookmark lookup" && node.children[0].type === "Constant index lookup")) {
            position = node.children[0].key.indexOf("->");
            tableName = node.children[0].key.substring(0, position);
            if (tableName === node.children[1].table) {
                node = node.children[0];
            }
            node.children = [
                {type: node.key.substring(0, position) + "(" + node.key.substring(position + 2) + ")"}
            ];
        } else if ((node.type === "Bookmark lookup" && node.children[0].type === "Index lookup")) {
            position = node.children[0].key.indexOf("->");
            node.children[0].type = node.children[0].key.substring(0, position) + "(" + node.children[0].key.substring(position + 2) + ")";
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
            position,
            tableName,
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
            if (children[1] && children[1].type === "Bookmark lookup") {
                if (children[1].children[1].type !== "Table") {
                    grandChild = children[1].children;
                    bookmarkType = grandChild.shift();
                    /*            excluding displaying bookmark lookup
                     tree.type += " using bookmark lookup(" + bookmarkType.type + ")";*/
                } else if (children[1].children.length === 2) {
                    if (children[1].children[1].type === "Table") {
                        children[1].type = "Query using index";
                        position = children[1].children[0].key.indexOf("->");
                        tableName = children[1].children[0].key.substring(0, position);
                        if (tableName === children[1].children[1].table) {
                            children[1].children.pop();
                        }
                    }
                }
            }

            if (children[1] && (children[1].type === "Index lookup" || children[1].type === "Unique index lookup")) {
                tree.type += " using index";
            }

            if ((tree.type === "Bookmark lookup" && tree.children[1].type !== "Table") || tree.type === "Index lookup") {
                tree = children[1];
            }

            if (tree.type === "Bookmark lookup" && tree.children[1].type === "Table") {
                tree.type = "Query using index";
                position = tree.children[0].key.indexOf("->");
                tableName = tree.children[0].key.substring(0, position);
                if (tableName === tree.children[1].table) {
                    tree.children.pop();
                }
            }
            if ((children[0] && children[0].type === "Index scan") || (children[1] && children[1].type === "Index scan")) {
                if (tree.type.indexOf(" using index scan") === -1) {
                    tree.type += " using index scan";
                }
            }

            children.forEach(function (child) {
                childNodes.push(prettyPrint(child));
            });
            tree.children = childNodes;
            tree.id = id;
            return tree;
        } else if (tree.type === "Table") {
            tree.type = tree.table;
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
        selectedTable.rowCount = parseInt(obj.rows, 10);

        $.ajax({
            type: "POST",
            async: false,
            url: "/tablemetadata",
            data: encodeURI("tablemetadata=" + JSON.stringify(tableData)),
            dataType: "json",
            success: function (result) {
                queralyzer.App.renderTree(result);
                queralyzer.App.renderTableMetaData(tableData);
            },
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
                queralyzer.App.renderIndexMetaData(indexData);
            },
            error: function (e) {
                alert(e.responseText);
            }
        });
    }

    /*function logError(error) {
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
     }      */

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
            var columns = ["table", "name", "columns", "type", "cardinality"],
                data = [];
            indexData = jsData;
            jsData.forEach(function (d) {
                var a = {};
                a.table = d.tableName;
                a.name = d.indexName;
                a.type = d.indexType;
                a.cardinality = d.cardinality;
                a.columns = d.indexColumns;

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
            }

            update(cleanTree);
            prettyPrint(cleanTree);

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
            var data = $('form#queryForm').serialize().replace(/%0D%0A/g, "+");

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
        },
        isValidQuery: function (query) {
            var regexp = /\*|CREATE|ALTER|DROP|TRUNCATE|COMMENT|RENAME|INSERT|UPDATE|DELETE|CALL|LOCK TABLE|LOCK TABLES|GRANT|REVOKE/i;
            if (query.match(regexp)) {
                return false;
            }
            return true;
        },
        initialiseAddIndexModal: function () {
            $("#add-index-button").removeAttr("disabled");
            $('#index-name-select').css("display", 'inline');
            $('#new-index-name').css("display", 'none');
            selectedIndexData = null;
            $('#table-name-select').empty();
            $('#column-name-select').empty();
            $('#column-name-select2').empty();
            $('#index-name-select').empty();
            queralyzer.App.addTableNames();
            $('#indexTypeHash').prop('checked', false);
            $('#indexTypeBtree').prop('checked', false);
            $('#isNullable').prop('checked', false);
            $('#nonUnique').prop('checked', false);
            $('#new-index-name').prop('value', null);
            selectedIndexData = null;
            // Myisam and Innodb supports only Btree index type, so let's make it default
            $('#indexTypeBtree').prop('checked', true);

        },
        addTableNames: function () {
            var tableSelect = document.getElementById("table-name-select"),
                temp = tableData,
                columnNames;
            $('#table-name-select').empty();
            $('#column-name-select').empty();
            $('#column-name-select2').empty();
            //tableSelect.empty();
            $.each(tableData, function (index, value) {
                //alert(tableData[index].tableName + ";");
                var opt = document.createElement("option");
                opt.text = tableData[index].tableName;
                opt.value = tableData[index].tableName;

                tableSelect.add(opt);
            });
            queralyzer.App.addColumnNames(0);
            queralyzer.App.addIndexNames(0);
            $('#index-name-select').prop("selectedIndex", -1);
            /*
             columnNames=tableData[0].tableColumns;
             var columnSelect = document.getElementById("column-name-select2");
             $.each(columnNames, function (index, value) {
             var opt = document.createElement("option");
             //alert(columnNames[index]);
             opt.text = columnNames[index];
             opt.value = columnNames[index];
             columnSelect.add(opt); // IE only
             });*/

        },
        addColumnNames: function (tableId) {
            var columnSelect = document.getElementById("column-name-select"),
                tableSelected,
                columnNames;
            if (tableId !== undefined) {
                tableSelected = tableData[tableId].tableName;
            } else {
                tableSelected = document.getElementById("table-name-select").value;
            }

            $('#column-name-select').empty();
            $.each(tableData, function (index, value) {
                //alert(tableData[index].tableName + ";");
                if (tableData[index].tableName === tableSelected) {
                    columnNames = tableData[index].tableColumns;
                }
                $('#column-name-select').empty();
            });
            $.each(columnNames, function (index, value) {
                var opt = document.createElement("option");
                //alert(columnNames[index]);
                opt.text = columnNames[index];
                opt.value = columnNames[index];
                columnSelect.add(opt); // IE only
            });
        },
        addIndexNames: function (tableId) {
            var indexSelect = document.getElementById("index-name-select"),
                tableSelected,
                indexName;
            if (tableId !== undefined) {
                tableSelected = tableData[tableId].tableName;
            } else {
                tableSelected = document.getElementById("table-name-select").value;
            }
            $('#index-name-select').empty();

            $.each(indexData, function (index, value) {
                if (indexData[index].tableName === tableSelected) {
                    indexName = indexData[index].indexName;
                    var opt = document.createElement("option");
                    //alert(columnNames[index]);
                    opt.text = indexName;
                    opt.value = indexName;
                    indexSelect.add(opt); //Standard
                    selectedIndexData = indexData[index];

                }
            });
            $('#index-name-select').prop("selectedIndex", -1);

        },
        resetIndexData: function () {
            $('#column-name-select option:selected').prop('selected', false);
            $('#column-name-select2').empty();
            $('#indexTypeHash').prop('checked', false);
            $('#indexTypeBtree').prop('checked', false);
            $('#isNullable').prop('checked', false);
            $('#nonUnique').prop('checked', false);
            selectedIndexData = null;
        },
        displayIndexData: function () {
            queralyzer.App.resetIndexData();
            var columnSelect = document.getElementById("column-name-select"),
                selectedIndex = $('#index-name-select').val(),
                selectedTable = $('#table-name-select').val(),
                tableColumnList = $('#column-name-select').val();

            $.each(indexData, function (index, value) {
                if ((indexData[index].tableName === selectedTable) && (indexData[index].indexName === selectedIndex)) {
                    selectedIndexData = indexData[index];
                    var columnsInIndex = indexData[index].indexColumns,
                        k;
                    //alert(columnsInIndex[k]);
                    $('#column-name-select option').each(function (index) {
                        //$(this).removeAttr("selected");

                        for (k = 0; k < columnsInIndex.length; k++) {
                            if (this.value === columnsInIndex[k]) {
                                //alert(this.value);
                                $(this).prop("selected", "selected");
                                //$('#column-name-select option:selected').remove().appendTo('#column-name-select2');

                                break;
                            }
                        }
                    });

                    if (indexData[index].indexType === 'HASH') {
                        $('#indexTypeHash').prop('checked', true);
                    } else if (indexData[index].indexType === 'BTREE') {
                        $('#indexTypeBtree').prop('checked', true);
                    }
                    if (indexData[index].isNullable === true) {
                        $('#isNullable').prop('checked', true);
                    }
                    if (indexData[index].nonUnique === true) {
                        $('#nonUnique').prop('checked', true);
                    }

                }
            });

        },
        updateIndexData: function () {
            var tableSelected = $('#table-name-select').val(),
                columnSelected = $('#column-name-select2').val(),
                indexTypeSelected = $('input[name=indexType]:checked').val(),
                isNullableSelected = $('#isNullable').prop('checked'),
                nonUniqueSelected = $('#nonUnique').prop('checked'),
                indexSelected,
                newIndexObj,
                cols,
                newIndexJsnText;
            if ($('#new-index-name').val() !== "") {
                indexSelected = $('#new-index-name').val();
                cols = JSON.stringify(columnSelected.toString().split(","));
                newIndexJsnText = '{"cardinality":2, "columnCount": ' + columnSelected.length +
                    ', "indexColumns": ' + cols + ', "indexName": "' +
                    indexSelected + '", "indexType": "' + indexTypeSelected +
                    '","isNullable": ' + isNullableSelected + ', "nonUnique": ' + nonUniqueSelected +
                    ', "schemaName":null, "storageEngine":null, "tableName":"' + tableSelected + '"}';
                newIndexObj = JSON.parse(newIndexJsnText);
                indexData.push(newIndexObj);

            } else {
                indexSelected = $('#index-name-select').val();
                //updating the selected index.
                selectedIndexData.isNullable = isNullableSelected;
                selectedIndexData.nonUnique = nonUniqueSelected;
                selectedIndexData.indexType = indexTypeSelected;
                //alert(indexTypeSelected);
                //alert(selectedIndexData.isNullable);
                selectedIndexData.indexColumns = $('#column-name-select2').val();
                selectedIndexData.columnCount = selectedIndexData.indexColumns.length;
                //alert(selectedIndexData.indexColumns);
            }

            //this.renderIndexMetaData(indexData);
            $.ajax({
                type: "POST",
                async: "false",
                url: "/indexmetadata",
                data: encodeURI("indexmetadata=" + JSON.stringify(indexData)),
                dataType: "json",
                success: function (result) {
                    queralyzer.App.renderTree(result);
                    queralyzer.App.renderIndexMetaData(indexData);
                },
                error: function (e) {
                    alert(e.responseText);
                }
            });
            $('#indexModal').modal('hide');

        },
        hideIndexSelect: function () {
            $('#index-name-select').css("display", 'none');
            $('#new-index-name').css("display", 'inline');
        }
    };
})();





