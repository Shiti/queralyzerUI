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
                queralyzer.App.createExplainTree();
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
                queralyzer.App.createExplainTree();

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
    function createExplainTreeLayout(tree_in_json) {
        $("#explainTreeContainer").empty();
        var margin = {top: 20, right: 20, bottom: 20, left: 20},
            width = 2400 - margin.right - margin.left,
            height = 2400 - margin.top - margin.bottom;

        var i = 0,
            duration = 750,
            root;

        var tree = d3.layout.tree()
            .size([height, width]);

        var diagonal = d3.svg.diagonal()
            .projection(function (d) {
                return [d.x, d.y];
            });

        root = tree_in_json;
        root.x0 = 100;
        root.y0 = width / 2;

        // set id and update children information for TableTreeNode
        var nodes = tree.nodes(root);
        var j = 0;
        nodes.forEach(function (d) {
            d.id = j++;
        });
        var svg = d3.select("#explainTreeContainer").append("svg")
            .attr("width", width + margin.right + margin.left)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .attr("class", "explainTreeContainer");

        //console.log(root);
        /*function collapse(d) {
         if (d.children) {
         d._children = d.children;
         d._children.forEach(collapse);
         d.children = null;
         }
         }
         root.children.forEach(collapse);
         */

        //update([root], 0);

        update2(root);
        d3.select(self.frameElement).style("height", "2400px");
        /*
         function update(root, root_id) {
         var node,
         name = "node" + (root_id);
         if (root_id === undefined) {
         return;
         }
         //console.log(name);
         if (root[0].data) {
         var elem = d3.select("#" + name);
         if (elem !== null) {
         node = elem.selectAll("div")
         .data(root[0].children)
         .enter()
         .append("div")
         .attr("class", function (d) {
         if (d.type === "TreeNode") {
         return "lightBlueBox";
         }
         else if (d.type === "TableTreeNode") {
         return "lightMaroonBox";
         }
         })
         .attr("id", function (d) {
         return "node" + (d.id);
         })
         .attr("type", function (d) {
         console.log(d.type);
         return d.type || "dummyClass";

         })
         .append("span")
         .text(function (d) {
         console.log(d.name);
         return (d.name + "\n") || "dummy";
         });
         }
         }
         //.style("float","left")
         for (i in root[0].children) {

         update([root[0].children[i]], root[0].children[i].id);
         }
         };
         */
        function update2(source) {
            // Compute the new tree layout.
            var nodes = tree.nodes(root),
                links = tree.links(nodes);

            //Normalize for fixed-depth.
            nodes.forEach(function (d) {
                d.y = d.depth * 100;
            });
            var node = svg.selectAll("g.node")
                .data(nodes);
            // Enter any new nodes at the parent's previous position.
            var nodeEnter = node.enter()
                .append("g")
                .attr("transform", function (d) {
                    //var prev_height = (d.parent) ? d.parent.dim[1] : 0;
                    return "translate(" + source.x0 + "," + source.y0 + ")";
                });

            //var bbox = nodeText.node().getBBox();
            var rectangle = nodeEnter.append("rect")
                .attr("width", function (d) {
                    return d.dim[0] + 5;
                })
                .attr("height", function (d) {
                    return d.dim[1] + 10;
                })
                .attr("class", "lightBlueBox")
                .style("fill-opacity", 1)
                .style("stroke", "#666")
                .style("stroke-width", "1.5px")
                .style("margin", "1x")
                .style("fill", "#7d7d7d");

            var nodeText = nodeEnter.append("svg:text")
                .attr("x", function (d) {
                    return d.dim[0];
                })
                .attr("y", function (d) {
                    return d.y_value[0];
                })
                .attr("text-anchor", function (d) {
                    return d.children || d._children ? "end" : "start";
                })
                .attr("id", function (d) {
                    return d.name + d.id;
                })
                .text(function (d) {
                    var flags_str = "";
                    if (d.flags) {
                        flags_str += d.flags.join("\n");
                    }
                    return d.title;//+ flags_str;
                    //return d.title;
                });//.selectAll("tspan").data(function(d){return d.flags;}).enter().append("tspan").text(function(flag){
//                    return flag;
//                });

            nodes.forEach(function (n) {
                if (n.flags) {
                    var textElem = $("#" + n.name + n.id);
                    n.flags.forEach(function (flag, index) {
                        var tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                        $(tspan).text(flag);
                        $(tspan).attr("x", n.dim[0]);
                        $(tspan).attr("y", n.y_value[index + 1]);
                        textElem.append(tspan);

                    });
                }
            });

            // Transition nodes to their new position.
            var nodeUpdate = node.transition()
                .duration(duration)
                .attr("transform", function (d) {
                    var prev_height = (d.parent) ? d.parent.dim[1] : 0;
                    var height = d.y + prev_height;
                    //console.log(prev_height);
                    return "translate(" + (d.x - d.dim[0] / 2) + "," + d.y + ")";
                });

            // Transition exiting nodes to the parent   's new position.
            var nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", function (d) {
                    return "translate(" + source.x + "," + source.y + ")";
                })
                .remove();

            // Update the links…
            var link = svg.selectAll("path.link")
                .data(links);
            //, function (d) {
            //          return d.target.id;
            //    });

            // Enter any new links at the parent's previous position.
            link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", function (d) {
                    var o = {x: source.y0, y: source.x0 };
                    return diagonal({source: o, target: o});
                });
            /*.attr("x1", function (d){
             d.source.x;
             })
             .attr("y1", function (d){
             d.source.y+ d.source.dim[1];
             })
             .attr("x2", function (d){
             d.target.x;
             })
             .attr("y2", function (d){
             d.target.y;
             });

             .attr("transform", function (d) {
             var prev_height = 0;
             if (d.source.parent){
             prev_height=d.source.parent.dim[1];
             }
             var height = d.source.y + prev_height;
             //console.log(prev_height);
             return "translate(" + 0 + "," + 0 + ")";
             })
             .attr("d", function (d) {
             var o = {x: source.y0 , y: source.x0 };
             return diagonal({source: o, target: o});
             });
             */
            // Transition links to their new position.
            link.transition()
                .duration(duration)
                .attr("d", diagonal);

            // Transition exiting nodes to the parent's new position.
            /*link.exit().transition()
             .duration(duration)
             .attr("d", function (d) {
             var o = {x: source.y0 + (source.dim[1] / 2), y: source.x0 + (source.dim[0] / 2)};
             return diagonal({source: o, target: o});
             })
             .remove();
             */
            // Stash the old positions for transition.
            nodes.forEach(function (d) {
                d.x0 = d.y;
                d.y0 = d.x;
            });
        };
        // Toggle children on click.
        function click2(d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            if (d.type === "TreeNode") {
                update2(d);
            }
            else {
                update(d, d.id);
            }
        };
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
                    queralyzer.App.createExplainTree();
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
            $('#Unique').prop('checked', false);
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
            $('#Unique').prop('checked', false);
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

                    /*if (indexData[index].indexType === 'HASH') {
                     $('#indexTypeHash').prop('checked', true);
                     } else if (indexData[index].indexType === 'BTREE') {
                     $('#indexTypeBtree').prop('checked', true);
                     } */
                    //Hash is not used by MyIsam or InnoDB
                    $('#indexTypeBtree').prop('checked', true);
                    if (indexData[index].Unique === true) {
                        $('#Unique').prop('checked', true);
                    }

                }
            });

        },
        updateIndexData: function () {
            var tableSelected = $('#table-name-select').val(),
                columnSelected = $('#column-name-select2').val(),
                indexTypeSelected = $('input[name=indexType]:checked').val(),
                uniqueSelected = $('#Unique').prop('checked'),
                indexSelected,
                newIndexObj,
                cols,
                newIndexJsnText;
            if ($('#new-index-name').val() !== "") {
                indexSelected = $('#new-index-name').val();
                cols = JSON.stringify(columnSelected.toString().split(","));
                if ($('#new-index-name').val() === "PRIMARY KEY") {
                    uniqueSelected = true;
                    $('#Unique').prop('checked', true);
                }
                newIndexJsnText = '{"cardinality":2, "columnCount": ' + columnSelected.length +
                    ', "indexColumns": ' + cols + ', "indexName": "' +
                    indexSelected + '", "indexType": "' + indexTypeSelected +
                    '", "Unique": ' + uniqueSelected +
                    ', "Spatial": ' + "false" +
                    ', "FullText": ' + "false" +
                    ', "schemaName":null, "storageEngine":null, "tableName":"' + tableSelected + '"}';
                //console.log(newIndexJsnText);
                newIndexObj = JSON.parse(newIndexJsnText);
                indexData.push(newIndexObj);

            } else {
                indexSelected = $('#index-name-select').val();
                //updating the selected index.
                selectedIndexData.Unique = uniqueSelected;
                selectedIndexData.Spatial = "false";
                selectedIndexData.FullText = "false";
                selectedIndexData.indexType = indexTypeSelected;
                //alert(indexTypeSelected);
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
                    queralyzer.App.createExplainTree();
                },
                error: function (e) {
                    alert(e.responseText);
                }
            });
            $('#indexModal').modal('hide');

        },
        createExplainTree: function () {
            var tree_in_json,
                tree_layout;
            $.ajax({
                type: "GET",
                asynch: "false",
                url: "/explainjson",
                datatype: "json",
                success: function (result) {
                    tree_in_json = Tree.generateTree(result);
                    console.log((tree_in_json));
                    createExplainTreeLayout(tree_in_json);
                },
                error: function (e) {
                    alert(e.responseText);
                }
            });
        },
        hideIndexSelect: function () {
            $('#index-name-select').css("display", 'none');
            $('#new-index-name').css("display", 'inline');
        }
    };
})();





