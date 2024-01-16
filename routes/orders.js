const asyncMiddleware = require("../middlewares/async");
const express = require("express");
const authMiddleware = require("../middlewares/auth");
const { validate: validateOrder, Order } = require("../models/orders.model");

const router = express.Router();

router.post(
  "/",
  asyncMiddleware(async (req, res) => {
    const { error } = validateOrder(req.body);
    if (error)
      return res.status(422).json({ message: error.details[0].message });

    const { orders, user, uuid, amountToPay } = req.body;

    const order = await Order.create({ orders, user, uuid, amountToPay });

    res.status(200).json({ message: "Order created successfully", order });
  })
);

router.get(
  "/",
  authMiddleware,
  asyncMiddleware(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      createdAt: { $gte: today, $lte: endOfDay },
    })
      .populate("orders.edibles.edible")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Orders", orders });
  })
);

router.put(
  "/:orderId/accept",
  authMiddleware,
  asyncMiddleware(async (req, res) => {
    const orderId = req.params.orderId;
    const { deliveryPerson } = req.body;

    if (!deliveryPerson)
      return res.status(400).json({ message: "Somebody needs to do this" });

    const order = await Order.findOne({ _id: orderId }).populate(
      "orders.edibles.edible"
    );

    if (!order) return res.status(400).json({ message: "Order not found" });

    if (order.status !== "pending") {
      return res.status(400).json({
        message: `${order.deliveryPerson} already handled this order`,
      });
    }

    order.deliveryPerson = deliveryPerson;
    order.status = "accepted";
    await order.save();

    res.status(200).json({ message: "Order Accepted", order });
  })
);

router.put(
  "/:orderId/complete",
  authMiddleware,
  asyncMiddleware(async (req, res) => {
    const orderId = req.params.orderId;
    const { deliveryPerson } = req.body;

    const order = await Order.findOne({ _id: orderId }).populate(
      "orders.edibles.edible"
    );

    if (!order) return res.status(400).json({ message: "Order not found" });

    if (order.deliveryPerson !== deliveryPerson)
      return res.status(400).json({
        message: `${order.deliveryPerson} is already working on this order`,
      });

    order.status = "completed";
    await order.save();

    res.status(200).json({ message: "Order Completed", order });
  })
);

router.put(
  "/:orderId/cancel",
  authMiddleware,
  asyncMiddleware(async (req, res) => {
    const orderId = req.params.orderId;
    const { deliveryPerson } = req.body;

    const order = await Order.findOne({ _id: orderId }).populate(
      "orders.edibles.edible"
    );

    if (!order) return res.status(400).json({ message: "Order not found" });

    if (order.status === "cancelled")
      return res
        .status(400)
        .json({
          message: `${order.deliveryPerson} already cancelled this order`,
        });

    if (order.deliveryPerson && order.deliveryPerson !== deliveryPerson)
      return res
        .status(400)
        .json({ message: `${order.deliveryPerson} is already on this order` });

    order.deliveryPerson = deliveryPerson;
    order.status = "cancelled";
    await order.save();

    res.status(200).json({ message: "Order Cancelled", order });
  })
);

router.get(
  "/by-uuids",
  asyncMiddleware(async (req, res) => {
    const uuids = req.query.ids.split(",");
    const orders = await Order.find({ uuid: { $in: uuids } });
    res.status(200).json({ message: "Orders fetched successfully", orders });
  })
);

module.exports = router;
