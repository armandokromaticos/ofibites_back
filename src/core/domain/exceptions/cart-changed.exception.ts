/**
 * El carrito cambió (líneas quitadas, cantidades distintas u otro checkout)
 * entre que se leyó y se confirmó el pedido. La transacción se revierte.
 */
export class CartChangedException extends Error {
  constructor(cartId: string) {
    super(`El carrito ${cartId} cambió durante el checkout`);
    this.name = "CartChangedException";
  }
}
