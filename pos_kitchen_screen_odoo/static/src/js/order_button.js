/** @odoo-module */  
import { patch } from "@web/core/utils/patch";
import { ActionpadWidget } from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import { useService } from "@web/core/utils/hooks";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { _t } from "@web/core/l10n/translation";

/**
 * @props partner
 */

patch(ActionpadWidget.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.popup = useService("popup");
    },
    get swapButton() {
        return this.props.actionType === "payment" && this.pos.config.module_pos_restaurant;
    },
    get currentOrder() {
        return this.pos.get_order();
    },
    get swapButtonClasses() {
        return {
            "highlight btn-primary": this.currentOrder?.hasChangesToPrint(),
            altlight:
                !this.currentOrder?.hasChangesToPrint() && this.currentOrder?.hasSkippedChanges(),
        };
    },

    async submitOrder() {
        var line = [];
        var self = this;

        if (!this.clicked) {
            this.clicked = true;
            try {
                var order_name = this.pos.selectedOrder.name;

                // Check if the current order is already completed
                await this.orm.call("pos.order", "check_order_status", ["", order_name]).then(function(result) {
                    if (result == false) {
                        self.kitchen_order_status = false;
                        self.popup.add(ErrorPopup, {
                            title: _t("Order is Completed"),
                            body: _t("The order is completed, please create a new order."),
                        });
                    } else {
                        self.kitchen_order_status = true;
                    }
                });

                // If the kitchen order status is valid (i.e., not already completed)
                if (self.kitchen_order_status) {
                    await this.pos.sendOrderInPreparationUpdateLastChange(this.currentOrder);
                    
                    for (const orders of this.currentOrder.orderlines) {
                        line.push([0, 0, {
                            'qty': orders.quantity,
                            'price_unit': orders.price,
                            'price_subtotal': orders.quantity * orders.price,
                            'price_subtotal_incl': orders.get_display_price(),
                            'discount': orders.discount,
                            'product_id': orders.product.id,
                            'tax_ids': [
                                [6, 0, orders.get_taxes().map((tax) => tax.id)]
                            ],
                            'pack_lot_ids': [],
                            'full_product_name': orders.product.display_name,
                            'price_extra': orders.price_extra,
                            'name': orders.product.display_name,
                            'is_cooking': true,
                            'note': orders.note
                        }]);
                    }

                    var order_data = {
                        'pos_reference': this.currentOrder.name,
                        'session_id': this.currentOrder.pos_session_id,
                        'amount_total': this.currentOrder.get_total_with_tax(),
                        'amount_paid': this.currentOrder.get_total_paid(),
                        'amount_return': this.currentOrder.get_change(),
                        'amount_tax': this.currentOrder.get_total_tax(),
                        'lines': line,
                        'is_cooking': true,
                        'order_status': 'draft',
                        'company_id': this.pos.company.id,
                        'hour': this.currentOrder.date_order.c.hour,
                        'minutes': this.currentOrder.date_order.c.minute,
                        'table_id': this.currentOrder.table?.id || null,
                        'floor': this.currentOrder.pos.currentFloor?.name || null,
                        'config_id': this.pos.config.id
                    };

                    // Create a new kitchen ticket if the order is already completed or ready
                    if (this.currentOrder && this.currentOrder.orderlines.length > 0) {
                        await this.orm.call("kitchen.screen", "create_new_kitchen_order", [this.currentOrder.id]);
                    } else {
                        self.popup.add(ErrorPopup, {
                            title: _t("Invalid Order"),
                            body: _t("The order is either incomplete or empty. Please add items before submitting."),
                        });
                    }

                    // Get the updated details for the POS after creating the new order
                    await self.orm.call("pos.order", "get_details", ["", this.pos.config.id, [order_data]]);
                }
            } finally {
                this.clicked = false;
            }
        }
    },
    
    hasQuantity(order) {
        if (!order) {
            return false;
        } else {
            return (
                order.orderlines.reduce((totalQty, line) => totalQty + line.get_quantity(), 0) > 0
            );
        }
    },
    
    get highlightPay() {
        return (
            super.highlightPay &&
            !this.currentOrder.hasChangesToPrint() &&
            this.hasQuantity(this.currentOrder)
        );
    },
    
    get categoryCount() {
        const orderChange = this.currentOrder.getOrderChanges().orderlines;
        const categories = Object.values(orderChange).reduce((acc, curr) => {
            const categoryId = this.pos.db.product_by_id[curr.product_id].pos_categ_ids[0];
            const category = this.pos.db.category_by_id[categoryId];
            if (category) {
                if (!acc[category.id]) {
                    acc[category.id] = { count: curr.quantity, name: category.name };
                } else {
                    acc[category.id].count += curr.quantity;
                }
            }
            return acc;
        }, {});
        return Object.values(categories);
    },
    
    get displayCategoryCount() {
        return this.categoryCount.slice(0, 3);
    },
    
    get isCategoryCountOverflow() {
        if (this.categoryCount.length > 3) {
            return true;
        }
        return false;
    },
});
