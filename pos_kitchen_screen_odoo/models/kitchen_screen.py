import logging
from odoo import api, fields, models

_logger = logging.getLogger(__name__)

class KitchenScreen(models.Model):
    """Kitchen Screen model for the cook"""
    _name = 'kitchen.screen'
    _description = 'POS Kitchen Screen'
    _rec_name = 'sequence'

    def _pos_shop_id(self):
        """Domain for the POS Shop"""
        kitchen = self.search([])
        if kitchen:
            return [('module_pos_restaurant', '=', True),
                    ('id', 'not in', [rec.id for rec in kitchen.pos_config_id])]
        else:
            return [('module_pos_restaurant', '=', True)]

    sequence = fields.Char(readonly=True, default='New',
                           copy=False, tracking=True, help="Sequence of items")
    pos_config_id = fields.Many2one('pos.config', string='Allowed POS',
                                    domain=_pos_shop_id,
                                    help="Allowed POS for kitchen")
    pos_categ_ids = fields.Many2many('pos.category',
                                     string='Allowed POS Category',
                                     help="Allowed POS Category"
                                          "for the corresponding POS")
    shop_number = fields.Integer(related='pos_config_id.id', string='Customer',
                                 help="Id of the POS")

    def kitchen_screen(self):
        """Redirect to corresponding kitchen screen for the cook"""
        return {
            'type': 'ir.actions.act_url',
            'target': 'new',
            'url': '/pos/kitchen?pos_config_id=%s' % self.pos_config_id.id,
        }

    @api.model
    def create(self, vals):
        """Used to create sequence"""
        # Add logic to generate a new sequence number for each new kitchen order
        if vals.get('sequence', 'New') == 'New':
            vals['sequence'] = self.env['ir.sequence'].next_by_code('kitchen.screen')
        # Ensure a new kitchen order is created whenever a new item is added
        result = super(KitchenScreen, self).create(vals)
        return result

@api.model
def create_new_kitchen_order(self, pos_order_id):
    """Create a new kitchen order for additional items added to an existing table"""

    # Log that we are attempting to create a new kitchen order
    _logger.info("Attempting to create a new kitchen order for POS order ID: %s", pos_order_id)

    # Ensure pos_order_id is valid
    if not pos_order_id:
        _logger.error("create_new_kitchen_order called without a valid POS order ID.")
        raise ValueError("No POS Order provided. The order list is empty.")

    # Convert the ID into a record by browsing it
    pos_order = self.env['pos.order'].browse(pos_order_id)

    # Validate if the order exists in the database
    if not pos_order.exists():
        _logger.error("POS Order does not exist for the provided ID: %s", pos_order_id)
        raise ValueError("POS Order does not exist.")

    # Ensure that the POS order has lines (products)
    if not pos_order.lines:
        _logger.error("The POS order ID %s has no lines. Cannot create kitchen order without items.", pos_order_id)
        raise ValueError("No POS Order lines found. The order list is empty.")

    # Log that we are proceeding with creating the kitchen order
    _logger.info("POS Order ID %s is valid. Proceeding to create a kitchen order.", pos_order_id)

    # Prepare values for creating the kitchen order
    vals = {
        'sequence': self.env['ir.sequence'].next_by_code('kitchen.screen'),
        'pos_config_id': pos_order.session_id.config_id.id,
        'pos_categ_ids': [(6, 0, pos_order.lines.mapped('product_id.pos_categ_id').ids)]
    }

    # Log the values being used for creating the new kitchen order
    _logger.debug("Creating new kitchen order with values: %s", vals)

    # Creating the new kitchen order
    new_order = self.create(vals)
    _logger.info("Successfully created a new kitchen order with sequence: %s", new_order.sequence)
    return new_order

