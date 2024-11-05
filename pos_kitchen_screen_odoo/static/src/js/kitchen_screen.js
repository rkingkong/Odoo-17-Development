/** @odoo-module */

import { registry } from "@web/core/registry";
const { Component, onWillStart, useState, onMounted } = owl;
import { useService } from "@web/core/utils/hooks";

class kitchen_screen_dashboard extends Component {

    setup() {
        super.setup();
        this.busService = this.env.services.bus_service;
        this.busService.addChannel("pos_order_created");

        // Adding the notification listener for order creation
        onWillStart(() => {
            this.busService.addEventListener('notification', this.onPosOrderCreation.bind(this));
        });

        this.action = useService("action");
        this.rpc = this.env.services.rpc;
        this.orm = useService("orm");
        var self = this;

        this.state = useState({
            order_details: [],
            shop_id: [],
            stages: 'draft',
            draft_count: [],
            waiting_count: [],
            ready_count: [],
            lines: []
        });

        var session_shop_id;

        // if refreshing the page then the last passed context (shop id) save to the session storage
        if (this.props.action.context.default_shop_id) {
            sessionStorage.setItem('shop_id', this.props.action.context.default_shop_id);
            this.shop_id = this.props.action.context.default_shop_id;
            session_shop_id = sessionStorage.getItem('shop_id');
        } else {
            session_shop_id = sessionStorage.getItem('shop_id');
            this.shop_id = parseInt(session_shop_id, 10);
        }

        // Fetch the initial details for the kitchen screen
        self.fetchInitialOrderDetails();
    }

    fetchInitialOrderDetails() {
        var self = this;
        if (self.shop_id) {
            self.orm.call("pos.order", "get_details", ["", self.shop_id, ""]).then(function (result) {
                self.updateOrderDetails(result);
            }).catch(function (error) {
                console.error("Error fetching initial order details:", error);
            });
        } else {
            console.warn("Shop ID is not available. Unable to fetch initial order details.");
        }
    }

    updateOrderDetails(result) {
        // Reusable function to update order details state
        if (result && result.orders) {
            this.state.order_details = result['orders'];
            this.state.lines = result['order_lines'];
            this.state.shop_id = this.shop_id;
            this.state.draft_count = this.state.order_details.filter((order) => order.order_status === 'draft' && order.config_id[0] === this.state.shop_id).length;
            this.state.waiting_count = this.state.order_details.filter((order) => order.order_status === 'waiting' && order.config_id[0] === this.state.shop_id).length;
            this.state.ready_count = this.state.order_details.filter((order) => order.order_status === 'ready' && order.config_id[0] === this.state.shop_id).length;
        } else {
            console.warn("No order details available to update.");
        }
    }

    onPosOrderCreation(message) {
        let payload = message.detail[0].payload;
        var self = this;

        if (payload.message === "pos_order_created" && payload.res_model === "pos.order") {
            if (payload.res_id) {
                // Fetch updated order details
                self.orm.call("pos.order", "get_details", ["", self.shop_id, ""]).then(function (result) {
                    self.updateOrderDetails(result);
                }).catch(function (error) {
                    console.error("Error fetching updated order details after order creation:", error);
                });

                // Only call create_new_kitchen_order if a valid order ID exists
                self.createKitchenOrder(payload.res_id);
            } else {
                console.warn("POS order ID is missing in the notification payload.");
            }
        }
    }

    createKitchenOrder(pos_order_id) {
        var self = this;

        // Ensure valid POS order ID before proceeding
        if (pos_order_id) {
            self.orm.call("kitchen.screen", "create_new_kitchen_order", [pos_order_id]).then(function (newOrder) {
                if (newOrder) {
                    self.state.order_details.push(newOrder);
                    self.state.draft_count += 1; // Update draft count
                }
            }).catch(function (error) {
                console.error("Error creating new kitchen order:", error);
            });
        } else {
            console.error("Invalid POS order ID. Cannot create a kitchen order.");
        }
    }

    // Existing methods for handling order actions
    cancel_order(e) {
        var input_id = $("#" + e.target.id).val();
        this.orm.call("pos.order", "order_progress_cancel", [Number(input_id)]).catch(function (error) {
            console.error("Error cancelling the order:", error);
        });
        var current_order = this.state.order_details.filter((order) => order.id === input_id);
        if (current_order) {
            current_order[0].order_status = 'cancel';
        }
    }

    accept_order(e) {
        var input_id = $("#" + e.target.id).val();
        ScrollReveal().reveal("#" + e.target.id, {
            delay: 1000,
            duration: 2000,
            opacity: 0,
            distance: "50%",
            origin: "top",
            reset: true,
            interval: 600,
        });
        var self = this;
        this.orm.call("pos.order", "order_progress_draft", [Number(input_id)]).catch(function (error) {
            console.error("Error accepting the order:", error);
        });
        var current_order = this.state.order_details.filter((order) => order.id === input_id);
        if (current_order) {
            current_order[0].order_status = 'waiting';
        }
    }

    // Stage handling methods
    ready_stage(e) {
        this.state.stages = 'ready';
    }

    waiting_stage(e) {
        this.state.stages = 'waiting';
    }

    draft_stage(e) {
        this.state.stages = 'draft';
    }

    done_order(e) {
        var input_id = $("#" + e.target.id).val();
        this.orm.call("pos.order", "order_progress_change", [Number(input_id)]).catch(function (error) {
            console.error("Error marking the order as done:", error);
        });
        var current_order = this.state.order_details.filter((order) => order.id === input_id);
        if (current_order) {
            current_order[0].order_status = 'ready';
        }
    }

    accept_order_line(e) {
        var input_id = $("#" + e.target.id).val();
        this.orm.call("pos.order.line", "order_progress_change", [Number(input_id)]).catch(function (error) {
            console.error("Error accepting the order line:", error);
        });
        var current_order_line = this.state.lines.filter((order_line) => order_line.id === input_id);
        if (current_order_line) {
            if (current_order_line[0].order_status === 'ready') {
                current_order_line[0].order_status = 'waiting';
            } else {
                current_order_line[0].order_status = 'ready';
            }
        }
    }

}

kitchen_screen_dashboard.template = 'KitchenCustomDashBoard';
registry.category("actions").add("kitchen_custom_dashboard_tags", kitchen_screen_dashboard);
