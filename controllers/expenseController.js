const Expense = require('../models/Expense');

const getExpenses = async (req, res) => {
    const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 });
    res.json(expenses);
}

const createExpense = async (req, res) => {
    const { title, amount, category, date, paymentMode, note } = req.body;
    const expense = new Expense({
        user: req.user._id,
        title, amount, category, date, paymentMode, note
    });
    const createdExpense = await expense.save();
    res.status(201).json(createdExpense);
}

module.exports = { getExpenses, createExpense };
