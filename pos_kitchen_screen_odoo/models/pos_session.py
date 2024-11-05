# -*- coding: utf-8 -*-
from odoo import models


class PosSession(models.Model):
    """Inheriting the pos session"""
    _inherit = 'pos.session'

    def _pos_ui_models_to_load(self):
        """Pos ui models to load"""
        result = super()._pos_ui_models_to_load()
        result += {
            'pos.order', 'pos.order.line'
        }
        return result

    def _loader_params_pos_order(self):
        """Load the fields to pos order"""
        return {'search_params': {
            'domain': [],
            'fields': ['name', 'date_order', 'pos_reference',
                       'partner_id', 'lines', 'order_status', 'order_ref',
                       'is_cooking']}}

    def _get_pos_ui_pos_order(self, params):
        """Get pos ui pos order"""
        return self.env['pos.order'].search_read(
            **params['search_params'])

    def _loader_params_pos_order_line(self):
        """Load the fields to pos order line"""
        return {'search_params': {'domain': [],
                                  'fields': ['product_id', 'qty',
                                             'order_status', 'order_ref',
                                             'customer_id',
                                             'price_subtotal', 'total_cost']}}

    def _get_pos_ui_pos_order_line(self, params):
        """Get pos ui pos order line"""
        data = self.env['pos.order.line'].search_read(
            **params['search_params'])
        return self.env['pos.order.line'].search_read(
            **params['search_params'])
