const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReportPage = async (req, res) => {
  try {
    const { day, page = 1, date } = req.query;
    const limit = 10; // Match frontend pagination
    const currentPage = parseInt(page) || 1;
    let query = { status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } }; // Exclude cancelled/returned

    // Date-based filtering
    if (day) {
      if (day === 'salesToday') {
        query.createdOn = {
          $gte: moment().startOf('day').toDate(),
          $lte: moment().endOf('day').toDate(),
        };
      } else if (day === 'salesWeekly') {
        query.createdOn = {
          $gte: moment().startOf('week').toDate(),
          $lte: moment().endOf('week').toDate(),
        };
      } else if (day === 'salesMonthly') {
        query.createdOn = {
          $gte: moment().startOf('month').toDate(),
          $lte: moment().endOf('month').toDate(),
        };
      } else if (day === 'salesYearly') {
        query.createdOn = {
          $gte: moment().startOf('year').toDate(),
          $lte: moment().endOf('year').toDate(),
        };
      }
    }

    if (date) {
      query.createdOn = {
        $gte: moment(date).startOf('day').toDate(),
        $lte: moment(date).endOf('day').toDate(),
      };
    }

    // Fetch orders with pagination
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);
    const orders = await Order.find(query)
      .populate('userId', 'email')
      .populate('orderedItems.product', 'productName')
      .sort({ createdOn: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    // Format data to match frontend
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      address: [order.address], // Match data[i].address[0].name
      product: order.orderedItems.map(item => ({
        _id: item.product._id,
        productName: item.product.productName,
      })), // Include productName
      createdOn: order.createdOn,
      payment: order.payment,
      status: order.status,
      totalPrice: order.totalPrice,
    }));

    res.render('salesReport', {
      data: formattedOrders,
      totalPages,
      currentPage,
      salesToday: day === 'salesToday',
      salesWeekly: day === 'salesWeekly',
      salesMonthly: day === 'salesMonthly',
      salesYearly: day === 'salesYearly',
      date: date || '',
    });
  } catch (err) {
    console.error('Error in getSalesReportPage:', err);
    res.redirect('/admin/pageerror');
  }
};

const dateWiseFilter = async (req, res) => {
  try {
    const { date } = req.query; // Changed to query for GET
    if (date) {
      res.redirect(`/admin/salesReport?date=${date}`);
    } else {
      res.redirect('/admin/salesReport');
    }
  } catch (err) {
    console.error('Error in dateWiseFilter:', err);
    res.redirect('/admin/pageerror');
  }
};

const generatePdf = async (req, res) => {
  try {
    const salesData = req.body;

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');

    doc.pipe(res);

    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text('Order ID | Customer | Date | Payment | Amount', { align: 'left' });
    doc.moveDown();

    salesData.forEach(item => {
      doc.text(
        `${item.dataId} | ${item.name} | ${item.date} | ${item.payment || 'N/A'} | ₹${item.totalAmount}`,
        { align: 'left' }
      );
    });

    doc.end();
  } catch (err) {
    console.error('Error in generatePdf:', err);
    res.status(500).json({ message: 'Error generating PDF' });
  }
};

const downloadExcel = async (req, res) => {
  try {
    const salesData = req.body;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 25 },
      { header: 'Customer', key: 'name', width: 20 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Payment', key: 'payment', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
    ];

    salesData.forEach(item => {
      worksheet.addRow({
        orderId: item.dataId,
        name: item.name,
        date: item.date,
        payment: item.payment || 'N/A',
        totalAmount: item.totalAmount,
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error in downloadExcel:', err);
    res.status(500).json({ message: 'Error generating Excel' });
  }
};

module.exports = {
  getSalesReportPage,
  dateWiseFilter,
  generatePdf,
  downloadExcel,
};