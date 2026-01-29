const Booking = require('../models/Booking');
const Expense = require('../models/Expense');

const getStats = async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = { user: req.user._id };
    // Assuming YYYY-MM-DD
    if (startDate && endDate) {
        query.date = { $gte: startDate, $lte: endDate };
    }

    try {
        // Fetch Raw Data
        const rawBookings = await Booking.find(query).sort({ date: 1 }).populate('space', 'name');
        const rawExpenses = await Expense.find(query).sort({ date: 1 });

        // Compute Stats in Memory
        let totalBookings = 0;
        let grossBookingAmount = 0;
        let totalDiscount = 0;
        let totalPaid = 0;
        let cashCollection = 0;
        let upiCollection = 0;

        for (const b of rawBookings) {
            totalBookings++;
            grossBookingAmount += (b.totalAmount || 0);
            totalDiscount += (b.discount || 0);

            const refund = b.refundAmount || 0;
            const actualPaid = (b.paidAmount || 0) - refund;
            totalPaid += actualPaid;

            // Mode Breakdown
            const mode = b.paymentMode || 'Cash';

            if (mode === 'Cash') {
                cashCollection += actualPaid;
            } else if (mode === 'UPI') {
                upiCollection += actualPaid;
            } else if (typeof mode === 'string' && mode.startsWith('Split')) {
                const cashMatch = mode.match(/Cash:\s*(\d+(\.\d+)?)/);
                const upiMatch = mode.match(/UPI:\s*(\d+(\.\d+)?)/);

                if (cashMatch) cashCollection += parseFloat(cashMatch[1]);
                if (upiMatch) upiCollection += parseFloat(upiMatch[1]);
            }
        }

        let totalExpenses = 0;
        for (const e of rawExpenses) {
            totalExpenses += (e.amount || 0);
        }

        const outstanding = grossBookingAmount - totalPaid;
        const netBalance = totalPaid - totalExpenses;

        res.json({
            bookings: {
                totalBookings,
                grossBookingAmount: Number(grossBookingAmount.toFixed(2)),
                totalDiscount: Number(totalDiscount.toFixed(2)),
                totalPaid: Number(totalPaid.toFixed(2)),
                cashCollection: Number(cashCollection.toFixed(2)),
                upiCollection: Number(upiCollection.toFixed(2))
            },
            expenses: {
                totalExpenses: Number(totalExpenses.toFixed(2))
            },
            financials: {
                outstanding: Number(outstanding.toFixed(2)),
                netBalance: Number(netBalance.toFixed(2))
            },
            rawData: {
                bookings: rawBookings,
                expenses: rawExpenses
            }
        });
    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: "Error generating reports" });
    }
};

module.exports = { getStats };
