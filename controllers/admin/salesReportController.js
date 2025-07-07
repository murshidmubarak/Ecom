const Order = require('../../models/orderSchema');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReportPage = async (req, res) => {
  try {
    const { day, page = 1, startDate, endDate } = req.query;
    const limit = 10;
    const currentPage = parseInt(page) || 1;
    let query = { status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } };

    // Store the current filter for template rendering
    let currentFilter = '';
    let isCustomDate = false;

    // Validate and apply date filters
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));

      // Validate date range
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
      }
      if (start > end) {
        throw new Error('Start date cannot be after end date');
      }

      query.createdOn = {
        $gte: start,
        $lte: end,
      };
      isCustomDate = true;
    } else if (day) {
      // Apply predefined date ranges
      const now = moment().endOf('day').toDate();
      let start;
      switch (day) {
        case 'salesToday':
          start = moment().startOf('day').toDate();
          currentFilter = 'salesToday';
          break;
        case 'salesWeekly':
          start = moment().subtract(7, 'days').startOf('day').toDate();
          currentFilter = 'salesWeekly';
          break;
        case 'salesMonthly':
          start = moment().subtract(30, 'days').startOf('day').toDate();
          currentFilter = 'salesMonthly';
          break;
        case 'salesYearly':
          start = moment().subtract(1, 'year').startOf('day').toDate();
          currentFilter = 'salesYearly';
          break;
        default:
          throw new Error('Invalid day filter');
      }
      query.createdOn = { $gte: start, $lte: now };
    } else {
      // Default to last 30 days if no filter is provided
      query.createdOn = {
        $gte: moment().subtract(30, 'days').startOf('day').toDate(),
        $lte: moment().endOf('day').toDate(),
      };
      currentFilter = 'default';
    }

    // Calculate total orders and paginated orders
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);
    const orders = await Order.find(query)
      .populate('userId', 'email')
      .populate('orderedItems.product', 'productName status isBlocked')
      .sort({ createdOn: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    // Format orders for display
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      address: [order.address],
      product: order.orderedItems.map(item => ({
        _id: item.product._id,
        productName: item.product.productName,
      })),
      createdOn: order.createdOn,
      payment: order.payment,
      status: order.status,
      totalPrice: order.totalPrice,
    }));

    // Calculate summary statistics
    const allOrders = await Order.find(query);
    const summaryGrandTotal = allOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const returnedOrders = await Order.countDocuments({ ...query, status: 'returned' });
    const shippedOrders = await Order.countDocuments({ ...query, status: 'shipped' });
    const pendingOrders = await Order.countDocuments({ ...query, status: 'pending' });
    const deliveredOrders = await Order.countDocuments({ ...query, status: 'delivered' });

    // Calculate top 10 best-selling products
    const allSalesOrders = await Order.find(query)
      .populate('orderedItems.product', 'productName status isBlocked');
    
    const productSales = {};
    for (const order of allSalesOrders) {
      for (const item of order.orderedItems) {
        const product = item.product;
        if (product && !product.isBlocked && product.status === 'Availabe') {
          const productId = product._id.toString();
          const quantity = parseInt(item.quantity) || 0;
          const price = parseFloat(item.price) || 0;
          if (!productSales[productId]) {
            productSales[productId] = {
              name: product.productName,
              sold: 0,
              revenue: 0,
            };
          }
          productSales[productId].sold += quantity;
          productSales[productId].revenue += price * quantity;
        }
      }
    }

    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Calculate top 10 best-selling categories
    const allOrdersWithCategories = await Order.find(query)
      .populate({
        path: 'orderedItems.product',
        populate: { path: 'category', select: 'name' },
        match: { isBlocked: false, status: 'Availabe' },
      });

    const categorySales = {};
    for (const order of allOrdersWithCategories) {
      for (const item of order.orderedItems) {
        if (item.product && item.product.category) {
          const categoryName = item.product.category.name || 'Uncategorized';
          const quantity = parseInt(item.quantity) || 0;
          const price = parseFloat(item.price) || 0;
          if (!categorySales[categoryName]) {
            categorySales[categoryName] = {
              sold: 0,
              revenue: 0,
            };
          }
          categorySales[categoryName].sold += quantity;
          categorySales[categoryName].revenue += price * quantity;
        }
      }
    }

    const topCategories = Object.entries(categorySales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Prepare data for sales graph
    const salesGraphData = [];
    const graphStartDate = startDate ? new Date(startDate) : query.createdOn.$gte;
    const graphEndDate = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : query.createdOn.$lte;

    let currentDate = moment(graphStartDate).startOf('day');
    while (currentDate <= moment(graphEndDate)) {
      const nextDate = moment(currentDate).add(1, 'day').startOf('day');
      const ordersInRange = await Order.find({
        createdOn: {
          $gte: currentDate.toDate(),
          $lt: nextDate.toDate(),
        },
        status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
      });

      const totalSales = ordersInRange.reduce((sum, order) => sum + order.totalPrice, 0);
      salesGraphData.push({
        date: currentDate.format('YYYY-MM-DD'),
        sales: totalSales,
      });
      currentDate = nextDate;
    }

    res.render('salesReport', {
      data: formattedOrders,
      totalPages,
      currentPage,
      currentFilter, // Pass the current filter
      isCustomDate, // Pass whether it's a custom date range
      startDate: startDate || '',
      endDate: endDate || '',
      topProducts,
      topCategories,
      salesGraphData,
      summaryGrandTotal: summaryGrandTotal.toFixed(2),
      totalOrders: allOrders.length,
      returnedOrders,
      shippedOrders,
      pendingOrders,
      deliveredOrders,
    });
  } catch (err) {
    console.error('Error in getSalesReportPage:', err.message);
    res.redirect('/admin/pageerror');
  }
};

const generatePdf = async (req, res) => {
  try {
    const salesData = req.body;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');

    doc.pipe(res);

    // Title
    doc.fontSize(18).text('Sales Report', { align: 'center' });
    doc.moveDown(3);

    // Table headers
    const tableTop = doc.y;
    const columnWidths = [120, 120, 120, 100, 90];
    const headers = ['Order ID', 'Customer', 'Date', 'Payment', 'Total Amount'];
    const rowHeight = 40;
    const textOffset = 12;

    // Draw header row
    doc.fontSize(10).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(
        header,
        50 + headers.slice(0, i).reduce((sum, _, j) => sum + columnWidths[j], 0),
        tableTop + textOffset,
        { width: columnWidths[i], align: 'left' }
      );
    });

    // Draw horizontal line below headers
    doc.moveTo(50, tableTop + rowHeight).lineTo(580, tableTop + rowHeight).stroke();
    doc.moveDown(1);

    // Draw data rows
    doc.font('Helvetica').fontSize(10);
    salesData.forEach((item, index) => {
      const rowTop = doc.y;
      const rowData = [
        item.dataId,
        item.name,
        item.date,
        item.payment || 'N/A',
        `₹${item.totalAmount}`,
      ];

      rowData.forEach((cell, i) => {
        doc.text(
          cell,
          50 + headers.slice(0, i).reduce((sum, _, j) => sum + columnWidths[j], 0),
          rowTop + textOffset,
          { width: columnWidths[i], align: 'left' }
        );
      });

      doc.moveTo(50, rowTop + rowHeight).lineTo(580, rowTop + rowHeight).stroke();
      doc.moveDown(1.5);
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

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
  generatePdf,
  downloadExcel,
};