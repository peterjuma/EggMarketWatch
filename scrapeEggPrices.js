const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function scrapeEggPrices() {
    const browser = await puppeteer.launch({
        headless: true, // Set to false for local debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const urls = [
        { region: 'KIKUYU', url: 'https://jiji.co.ke/kikuyu/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'ALL', url: 'https://jiji.co.ke/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NAIROBI', url: 'https://jiji.co.ke/nairobi/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KITENGELA', url: 'https://jiji.co.ke/kitengela/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KAJIADO', url: 'https://jiji.co.ke/kajiado/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KIAMBU', url: 'https://jiji.co.ke/kiambu/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KISERIAN', url: 'https://jiji.co.ke/kiserian/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NGONG', url: 'https://jiji.co.ke/ngong/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'MLOLONGO', url: 'https://jiji.co.ke/mlolongo/meals-and-drinks?filter_attr_1594_type=Eggs' },
    ];

    const allEggPrices = [];

    for (const entry of urls) {
        const { region, url } = entry;
        console.log(`Scraping ${region} at URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2' });

        const eggPrices = await page.evaluate((region) => {
            const items = document.querySelectorAll('.b-list-advert__gallery__item');
            console.log(`Found ${items.length} items on the page for ${region}`);

            const data = [];
            items.forEach(item => {
                const title = item.querySelector('.qa-advert-list-item-title')?.innerText || 'No Title';
                const priceText = item.querySelector('.qa-advert-price')?.innerText || 'No Price';
                const description = item.querySelector('.b-list-advert-base__description-text')?.innerText || 'No Description';
                const location = item.querySelector('.b-list-advert__region__text')?.innerText || 'No Location';

                const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

                data.push({
                    region,
                    title,
                    price,
                    description,
                    location,
                });
            });

            return data;
        }, region);

        if (eggPrices.length === 0) {
            console.log(`No data scraped for region: ${region}`);
        } else {
            console.log(`Scraped ${eggPrices.length} items for region: ${region}`);
        }

        allEggPrices.push(...eggPrices);
    }


    await browser.close();

    const categorizedPrices = {};
    allEggPrices.forEach(egg => {
        const category = categorizeEggType(egg.title, egg.description);
        const region = egg.region;

        if (!categorizedPrices[category]) {
            categorizedPrices[category] = {};
        }

        if (!categorizedPrices[category][region]) {
            categorizedPrices[category][region] = {
                total: 0,
                count: 0,
                min: Infinity,
                max: -Infinity,
            };
        }

        const regionData = categorizedPrices[category][region];
        regionData.total += egg.price;
        regionData.count += 1;
        regionData.min = Math.min(regionData.min, egg.price);
        regionData.max = Math.max(regionData.max, egg.price);
    });

    const htmlContent = generateHtmlTables(categorizedPrices);
    sendEmail(htmlContent);

    const dataFile = 'categorized_egg_prices_per_region.json';
    const currentDate = new Date().toISOString().split('T')[0];
    // Generate the new file name
    const currentDataFile = dataFile.replace('.json', `_${currentDate}.json`);
    
    fs.writeFileSync(currentDataFile, JSON.stringify(categorizedPrices, null, 2));

    console.log('Categorized egg prices per region have been saved to the file:', currentDataFile);
}

function categorizeEggType(title, description) {
    const combinedText = `${title} ${description}`.toLowerCase();

    if (combinedText.includes('kienyeji')) {
        return 'Kienyeji Eggs';
    } else if (combinedText.includes('fertilized')) {
        return 'Fertilized Eggs';
    } else if (combinedText.includes('layer')) {
        return 'Layer Eggs';
    } else if (combinedText.includes('wholesale')) {
        return 'Wholesale Eggs';
    } else if (combinedText.includes('farm fresh')) {
        return 'Farm Fresh Eggs';
    } else {
        return 'Other Eggs';
    }
}

function generateHtmlTables(categorizedPrices) {
    let summaryHtml = `
    <h2>Egg Price Summary by Region</h2>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; font-family: Arial, sans-serif;">
        <thead>
            <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Region</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Average Price</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Min Price</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Max Price</th>
            </tr>
        </thead>
        <tbody>`;

    const selectedRegions = ['KIAMBU', 'NAIROBI', 'KAJIADO', 'ALL'];

    for (const region of selectedRegions) {
        for (const category in categorizedPrices) {
            if (categorizedPrices[category][region]) {
                const regionData = categorizedPrices[category][region];
                const average = (regionData.total / regionData.count).toFixed(2);
                summaryHtml += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${region}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${category}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${average}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${regionData.min}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${regionData.max}</td>
                </tr>`;
            }
        }
    }

    summaryHtml += `
        </tbody>
    </table>
    <p style="font-family: Arial, sans-serif;">Data retrieved on ${new Date().toLocaleDateString('en-GB')}</p>`;

    return summaryHtml;
}

function sendEmail(htmlContent) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const currentDate = new Date().toLocaleDateString('en-GB'); // Formats the date as DD/MM/YYYY


    const mailOptions = {
        from: process.env.EMAIL_USER, // Sender's email address
        bcc: process.env.MAILING_LIST, // Send a blind copy to the sender
        subject: `Categorized Egg Prices per Region - ${currentDate}`,
        html: htmlContent,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

scrapeEggPrices();
