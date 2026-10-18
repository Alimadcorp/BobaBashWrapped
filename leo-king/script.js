let cart = [];

function addToCart(productName) {
    cart.push(productName);

    const message = document.getElementById("cart-message");

    if (message) {
        message.textContent =
            "Added " + productName +
            "! Items in your cart: " + cart.length;
    }

    console.log("Cart updated:", cart);
}
