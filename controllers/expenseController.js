const Expense = require('../models/Expense');

const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        console.error("Get Expenses Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const createExpense = async (req, res) => {
    try {
        const { title, amount, category, date, paymentMode, note } = req.body;
        const expense = new Expense({
            user: req.user._id,
            title, amount, category, date, paymentMode, note
        });
        const createdExpense = await expense.save();
        res.status(201).json(createdExpense);
    } catch (error) {
        console.error("Create Expense Error:", error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

module.exports = { getExpenses, createExpense };
