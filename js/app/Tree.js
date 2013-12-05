Tree = (function () {
    var TreeNode = function (parent, name, title, data) {
        var self = this;
        self.parent = parent;
        self.name = name;
        self.title = title;
        self.data = data;
        self.children = [];
        self.color = [0.83137254901960789, 0.92941176470588238, 0.99215686274509807, 1];
        self.type = "TreeNode";
        self.y_value = [];
        return this;
    };

    TreeNode.prototype.get_flags = function (data) {
        var self = this;
        if (self.data === undefined) {
            return [];
        }
        if (data === undefined) {
            data = self.data
        }
        var flags = [];
        var arr = ["using_temporary_table", "dependent", "using_filesort", "cacheable"];
        for (index in arr) {
            var key = arr[index];
            if (data[key] === true) {
                flags.push(key);
            }
        }
        return flags;
    };
    TreeNode.prototype.process = function () {
        var self = this;
        for (ch_index in self.children) {
            self.children[ch_index].process();

        }
        return this;
    };

    var util = {};

    util.inherits = function (f) {
        function G() {
        }

        G.prototype = f.prototype || f;
        return new G();
    };
    util.strip_useless_node = function (root) {
        if (((root.name === "query_specification") ||
            (root.name === "nested_loop_item") ||
            (root.name === "query_block")) &&
            (root.children.length === 1)) {
            root = root.children[0];
            root.parent = null;
        }
        var ch = root.children;
        for (i in ch) {
            if (((ch[i].name === "query_specification") ||
                (ch[i].name === "nested_loop_item") ||
                (ch[i].name === "query_block")) &&
                (ch[i].children.length === 1)) {
                ch[i] = ch[i].children[0];
                ch[i].parent = root;
            }
            util.strip_useless_node(ch[i]);
        }
        return root;
    };

    util.dimensions = function (self, font) {
        var w = 0,
            h = 0;
        if (self === undefined) {
            return [];
        }
        if (self.name) {
            var f = font || '12px arial',
                o = $('<div>' + self.title + '</div>')
                    .css({'position': 'absolute', 'float': 'left', 'white-space': 'nowrap', 'visibility': 'hidden', 'font': f})
                    .appendTo($('body'));
            w = Math.max(o.width(), w),
                h += o.height() + 5;
            self.y_value.push(h);
            o.remove();
        }
        if (self.flags) {
            for (i in self.flags) {
                var text = self.flags[i];
                var f = font || '12px arial',
                    o = $('<div>' + text + '</div>')
                        .css({'position': 'absolute', 'float': 'left', 'white-space': 'nowrap', 'visibility': 'hidden', 'font': f})
                        .appendTo($('body'));
                w = Math.max(o.width(), w),
                    h += o.height() + 5;
                self.y_value.push(h);
                o.remove();
            }
        }
        return [w, h];
    };
    util.calc_all = function (node) {
        node.dim = util.dimensions(node, 14);
        for (i in node.children) {
            util.calc_all(node.children[i]);
        }
    };

    var OperationNode = function (parent, name, title, data) {
        var self = this;
        TreeNode.call(self, parent, name, title, data);
        self.parent = parent;
        self.name = name;
        self.title = title;
        self.data = data;
        self.color = [0.92941176470588238, 0.99215686274509807, 0.83137254901960789, 1];
        self.type = "OperationNode";
        self.y_value = [];
        self.flags = self.get_flags();
        return self;
    };
    OperationNode.prototype = util.inherits(TreeNode);

    var SubQueryNode = function (parent, name, data) {
        var self = this;
        TreeNode.call(self, parent, name, "SUBQUERY", data);
        self.parent = parent;
        self.name = name;
        self.data = data;
        self.color = [0.8, 0.8, 0.8, 0.3];
        self.type = "SubQueryNode";
        self.y_value = [];
        return self;
    }
    SubQueryNode.prototype = util.inherits(TreeNode);
    SubQueryNode.prototype.process = function () {
        TreeNode.prototype.process.call(this);
        var self = this,
            tmp_table = {},
            query_block;
        for (ch in self.children) {
            if (self.children[ch].name === "query_block") {
                query_block = self.children[ch];
            }
            else if (self.children[ch] instanceof TableTreeNode) {
                tmp_table = self.children[ch];
            }
            else {
                console.log("Unexpected child type in subquery:");
            }
            if ((tmp_table) && (query_block)) {
                var index = this.children.indexOf(query_block);
                this.children.splice(index, 1);
                query_block.parent = tmp_table;
                tmp_table.children.push(query_block);
            }
        }
        return this;
    };

    var TableTreeNode = function (context, parent, name, title, data) {
        var self = this;
        TreeNode.call(self, parent, name, title, data);
        self.context = context;
        self.parent = parent;
        self.name = name;
        self.data = data;
        self.color = [0.8, 0.8, 0.8, 0.3];
        self.references = {};
        self.attached_text;
        self.body;
        self.flags_box;
        self.type = "TableTreeNode";
        self.y_value = [];
        self.flags = [];
        if (data.using_join_buffer) {
            self.flags.push("join buf (" + data.using_join_buffer + ")");
        }
        return self;
    };

    TableTreeNode.prototype = util.inherits(TreeNode);

    TableTreeNode.prototype.set_color = function (r, g, b, a) {
        this.color = [r , g, b, a];
    };

    TableTreeNode.prototype.process = function () {
        TreeNode.prototype.process.call(this);
        var attached_condition = (this.data === undefined) ? "" : this.data.attached_condition;
        if (attached_condition) {
            // ToDO: where is the attached condition being populated here
            var temp_arr = [this.name, attached_condition];
            this.context.attached_conditions = temp_arr;
            var len = this.context.attached_conditions.length;
            // This is not being used and we want to copy the complete condition into the attached_text
            //var condition_length = this.context.opt_condition_length || 32;
            //this.attached_text = "attached_condition[%i]: %s%s" % (i, attached_condition[:condition_length],"..." if len(attached_condition) >condition_length  else "")
            this.attached_text = "attached_condition[" + len + "]:" + attached_condition;
        }
        return this;
    };
    TableTreeNode.prototype.set_body_text = function (body) {
        var self = this;
        if (self.body === undefined) {
            self.body = body;
        }
        else {
            //self.body = TextRectangle(body);
            //r, g, b, a = self.heading.fill_color;
            //self.body.set_fill_color(r, g, b, 0.7);
            //self.body.set_color(*self.heading.color);
            //self.body.border_color = self.border_color;
            if (self.flags_box) {
                //self.body.draw_vertices = False, False, True, False;
            }
            else {
                //self.body.draw_vertices = None;

            }
            //self.body.padding = 3, 5, 5, 5;
        }
        var body_text = self.body.split("\n");
        for (i in body_text) {
            self.flags.push(body_text[i]);
        }


    };
    TableTreeNode.prototype.calc = function () {
        TreeNode.prototype.calc.call();
        if (this.references) {
            this.extra_bottom_space = 50;
        }
    };
    var IndexedTableTreeNode = function (context, parent, name, title, data) {
        var self = this;
        self.type = "IndexedTableTreeNode";
        TableTreeNode.call(self, context, parent, name, title, data);
        self.y_value = [];
        return this;
    };

    IndexedTableTreeNode.prototype = util.inherits(TableTreeNode);

    IndexedTableTreeNode.prototype.process = function () {
        var self = this;
        TableTreeNode.prototype.process.call(this);
        var tables = {},
            schema,
            table,
            column;
        if (this.parent.name === "nested_loop") {
            for (i in this.parent.children) {
                if (this.parent.children[i].data.table_name) {
                    tables[this.parent.children[i].data.table_name] = this.parent.children[i];
                }
            }

        }
        if (self.data.ref) {
            var columns = [],
                i = 0;
            var ref_values = self.data.ref;
            for (i = 0; i < ref_values.length; i++) {
                var ref_value = ref_values[i],
                    value_arr = ref_value.split(".");
                if (value_arr.length === 3) {
                    schema = value_arr[0];
                    table = value_arr[1];
                    column = value_arr[2];
                    columns.push(column);
                }
            }
            if (columns) { // schema and table must be the same for all refs
                if (tables[table]) {
                    var table_name = tables[table].toString();
                    self.references[table_name] = columns;
                }
                else {
                    console.log("reference target for " + self.data.ref + " not found")
                }
                self.set_is_key_ref('true');
            }
            else {
                self.set_is_key_ref('false');
            }
        }
        else {
            self.set_is_key_ref('false');
        }
        var index_condition = self.data.index_condition || "";
        if (index_condition) {
            self.context.index_conditions.push((self.name, index_condition)); // TODO:In javascript can;t push a tuple inside a array. Need to find other way.
            var len = self.context.index_conditions.length;
            //condition_length = self.context.get("opt_condition_length", 32)
            //self.attached_text = "index_condition[%i]: %s%s" % (i, index_condition[:condition_length], "..." if len(index_condition) > condition_length else "")
            self.attached_text = "index_condition[" + len + "]:" + index_condition;
        }
    };

    IndexedTableTreeNode.prototype.set_is_key_ref = function (flag) {
        var self = this;
        this.is_key_ref = flag;
        var key = self.data.key,
            keys = self.data.possible_keys || [],
            key_length = self.data.key_length || "",
            index,
            used_key_parts;
        if (key_length) {
            key_length = "key length: " + key_length;
        }
        used_key_parts = self.data.used_key_parts || "";
        if (used_key_parts) {
            used_key_parts = "used parts: " + used_key_parts   //TODO: ", ".join(used_key_parts);
        }
        var used_key_info;
        used_key_info = "\n" + key_length + "\n" + used_key_parts + "\n";

        //"\n    %s" % "\n    ".join(filter(None, [key_length, used_key_parts]));

        //if ref is not an external column name, then we add the ref value next to the key
        if ((flag) || (!self.data.ref)) {
            if (key in keys) {
                index = keys.indexOf(key);
                if (index > -1) {
                    keys.splice(index, 1);
                }
            }
            var text = "key: " + key + used_key_info;
        }
        else {
            index = keys.indexOf(key);
            if (index > -1) {
                keys.splice(index, 1);
            }
            text = "key: " + key + "->" + self.data.ref.toString() + used_key_info;
        }
        if (keys) {
            var keys_string = "";
            if (keys.toString() !== "") {
                keys_string = keys.toString();
                keys_string = "\npossible keys: " + keys_string;
            }
            self.set_body_text(text + keys_string);

        }
        else {
            self.set_body_text(text);
        }

    };
    var MaterializedTableTreeNode = function (context, parent, name, title, data) {
        var self = this;
        TableTreeNode.call(self, context, parent, name, title, data);
        self.set_body_text("SUBQUERY, materialized from");
        self.y_value = [];
        self.type = "MaterializedTableTreeNode";
        self.flags = self.get_flags(data.materialized_from_subquery);
        self.subtitle = self.flags.join("\n");
        return this;
    };

    MaterializedTableTreeNode.prototype = util.inherits(TableTreeNode);

    MaterializedTableTreeNode.prototype.process = function () {
        var self = this;
        for (ch_index in self.children) {
            if (self.children[ch_index].name === "materialized_from_subquery") {
                self.subquery_info = self.children[ch_index].data;
                // remove the subquery node¬
                for (cch_index in self.children[ch_index].children) {
                    self.children[ch_index].children[cch_index].parent = self;
                }
                var temp_list = self.children[ch_index];
                self.children.splice(ch_index, 1);
                self.children = self.children.concat(temp_list.children);
                break;
            }
        }
        self.subtitle.text = self.get_flags(self.subquery_info).join("\n");
        TableTreeNode.prototype.process.call(this);
    };


    var tree_from_json = function (context, parent, name, json) {
        var node,
            ch;
        if (name === "table") {
            node = process_table(context, parent, json);
        }
        else if (name.substring(-16) === "_subqueries item") {
            node = process_subquery(parent, json);
        }
        else {
            node = process_node(parent, name, json);
        }
        if (!node) {
            return null;
        }
        $.each(json, function (key, value) {
                if ((key === "possible_keys")
                    || (key === "ref")
                    || (key === "used_key_parts")) {
                    return true;
                }
                if (Object.prototype.toString.call(value) === '[object Object]') {
                    ch = tree_from_json(context, node, key, value);
                    if (ch) {
                        node.children.push(ch);

                    }
                }
                else if (Object.prototype.toString.call(value) === '[object Array]') {
                    if ((value)
                        &&
                        (Object.prototype.toString.call(value[0]) === '[object Object]')
                        &&
                        (Object.keys(value[0]).toString() === "table")) {
                        var interm = new TreeNode(node, key, key, {});
                        //interm.set_fill_color(0.83137254901960789, 0.92941176470588238, 0.99215686274509807, 1)
                        node.children.push(interm);
                        for (item in value) {
                            ch = tree_from_json(context, interm, "table", value[item].table);
                            if (ch) {
                                interm.children.push(ch);
                            }
                        }
                    }
                    else {
                        interm = new TreeNode(node, key, key, {});
                        node.children.push(interm);
                        for (item in value) {
                            ch = tree_from_json(context, interm, key + " item", value[item]);
                            if (ch) {
                                interm.children.push(ch);
                            }
                        }
                    }
                }
            }
        );
        return node;
    };


    var process_table = function (context, parent, table) {
        //Possible col_join_types (access_type) according to mysql 5.6.5 sources
        var col_join_types = [
                {name: "UNKNOWN", color: [1, 0, 0, 1], class_: TableTreeNode},
                {name: "system", color: null, class_: TableTreeNode},
                {name: "const", color: null, class_: TableTreeNode},
                {name: "eq_ref", color: [0.25, 0.5, 0.75, 1], class_: IndexedTableTreeNode},
                {name: "index", color: [1, 0.5, 0, 1], class_: IndexedTableTreeNode},
                {name: "ALL", color: [0.75, 0.25, 0.25, 1], class_: TableTreeNode},
                {name: "range", color: [0.0, 0.5, 0.25, 1], class_: IndexedTableTreeNode},
                {name: "ref", color: [0.0, 0.5, 0.25, 1], class_: IndexedTableTreeNode},
                {name: "fulltext", color: [1, 0.5, 0, 1], class_: TableTreeNode},
                {name: "ref_or_null", color: null, class_: TableTreeNode},
                {name: "unique_subquery", color: null, class_: TableTreeNode},
                {name: "index_subquery", color: null, class_: TableTreeNode},
                {name: "index_merge", color: null, class_: TableTreeNode}
            ],
            access_type = table.access_type || null,
            table_name = table.table_name || "",
            tableColor,
            tableClass,
            i,
            node;
        if (!access_type) {
            node = new TableTreeNode(context, parent, table_name, table.message || "???", table);
            //node.set_fill_color(0.25, 0.5, 0.75, 1)
            return node;
        }
        tableClass = TableTreeNode;
        //tableColor = 0.5, 0.5, 0.5, 1
        for (i in col_join_types) {
            if (col_join_types[i].name === access_type) {
                if (col_join_types[i].color) {
                    tableColor = col_join_types[i].color;
                }
                tableClass = col_join_types[i].class_;
            }
        }
        if ("materialized_from_subquery" in table) {
            tableClass = MaterializedTableTreeNode;
        }
        node = new tableClass(context, parent, table_name, (table_name + "  " + access_type), table);
        //node.set_fill_color(*tableColor)
        return node;
    };


    var process_subquery = function (parent, data) {
        var node = new SubqueryNode(parent, parent.name.replace("_subqueries", "_subquery"), data);
        return node;

    };

    var process_node = function (parent, name, data) {
        if (Object.prototype.toString.call(data) !== '[object Object]') {
            return null;
        }
        var oper = name,
            node;
        if (oper.substr(-10) === '_operation') {
            oper = oper.substring(0, oper.length - 10);
            if (oper.substr(-3) === 'ing') {
                oper = oper.substring(0, oper.length - 3);
                node = new OperationNode(parent, name, oper.toUpperCase(), data);
            }
        }
        else if (oper === 'query_block') {

            oper = 'query_block #' + data.select_id;
            node = new TreeNode(parent, name, oper, data);
            //node.set_fill_color(0.83137254901960789, 0.92941176470588238, 0.99215686274509807, 1);

        }
        else {
            node = new TreeNode(parent, name, oper, data);
            //node.set_fill_color(0.83137254901960789, 0.92941176470588238, 0.99215686274509807, 1);
        }
        return node;
    };
    var createExplainTreeLayout = function (tree_in_json) {
        var width = 2200,
            height = 1200;

        var tree = d3.layout.tree()
            .size([width - 20, height - 20]);

        var root = tree_in_json,
            nodes = tree(root);

        root.parent = root;
        root.px = root.x;
        root.py = root.y;

        var diagonal = d3.svg.diagonal();

        var svg = d3.select("body").append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(10,10)");

        var node = svg.selectAll(".node"),
            link = svg.selectAll(".link");

        var duration = 750,
            timer = setInterval(update, duration);

        function update() {
            if (nodes.length >= 500) return clearInterval(timer);

            // Add a new node to a random parent.
            //var n = {id: nodes.length},
            //  p = nodes[Math.random() * nodes.length | 0];
            // if (p.children) p.children.push(n); else p.children = [n];
            //nodes.push(n);

            // Recompute the layout and data join.
            node = node.data(tree.nodes(root), function (d) {
                return d.id;
            });
            link = link.data(tree.links(nodes), function (d) {
                return d.source.id + "-" + d.target.id;
            });

            // Add entering nodes in the parent’s old position.
            node.enter().append("circle")
                .attr("class", "node")
                .attr("r", 4)
                .attr("cx", function (d) {
                    return d.parent.px;
                })
                .attr("cy", function (d) {
                    return d.parent.py;
                });

            // Add entering links in the parent’s old position.
            link.enter().insert("path", ".node")
                .attr("class", "link")
                .attr("d", function (d) {
                    var o = {x: d.source.px, y: d.source.py};
                    return diagonal({source: o, target: o});
                });

            // Transition nodes and links to their new positions.
            var t = svg.transition()
                .duration(duration);

            t.selectAll(".link")
                .attr("d", diagonal);

            t.selectAll(".node")
                .attr("cx", function (d) {
                    return d.px = d.x;
                })
                .attr("cy", function (d) {
                    return d.py = d.y;
                });
        }
    };
    return {
        generateTree: function (explain_in_json) {
            var context = {
                    "index_conditions": [],
                    "attached_conditions": []
                },
                json = JSON.parse(explain_in_json),
                tree,
                tree_layout;
            tree = tree_from_json(context, null, "query_block", json.query_block);
            tree = tree.process();
            tree = util.strip_useless_node(tree);
            util.calc_all(tree);
            //tree_layout = createExplainTreeLayout(tree);
            return tree;
        }
    };
})
    ();