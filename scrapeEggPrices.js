const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function scrapeEggPrices() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const urls = [
        { region: 'KIKUYU', url: 'https://jiji.co.ke/kikuyu/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'ALL', url: 'https://jiji.co.ke/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NAIROBI', url: 'https://jiji.co.ke/nairobi/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KITENGELA', url: 'https://jiji.co.ke/kitengela/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KAJIADO', url: 'https://jiji.co.ke/kajiado/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'MOMBASA', url: 'https://jiji.co.ke/mombasa/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NAKURU', url: 'https://jiji.co.ke/nakuru/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'ELDORET', url: 'https://jiji.co.ke/eldoret/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KISII', url: 'https://jiji.co.ke/kisii/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NYERI', url: 'https://jiji.co.ke/nyeri/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'MERU', url: 'https://jiji.co.ke/meru/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'THIKA', url: 'https://jiji.co.ke/thika/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KAKAMEGA', url: 'https://jiji.co.ke/kakamega/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KERICHO', url: 'https://jiji.co.ke/kericho/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'KIAMBU', url: 'https://jiji.co.ke/kiambu/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NYAHURURU', url: 'https://jiji.co.ke/nyahururu/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NYANDARUA', url: 'https://jiji.co.ke/nyandarua/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NYAMIRA', url: 'https://jiji.co.ke/nyamira/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'NYERI', url: 'https://jiji.co.ke/nyeri/meals-and-drinks?filter_attr_1594_type=Eggs' },
        { region: 'BUNGOMA', url: 'https://jiji.co.ke/bungoma/meals-and-drinks?filter_attr_1594_type=Eggs' },
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

    fs.writeFileSync('categorized_egg_prices_per_region.json', JSON.stringify(categorizedPrices, null, 2));
    console.log('Categorized egg prices per region have been saved to categorized_egg_prices_per_region.json');
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
    let html = '';

    for (const category in categorizedPrices) {
        let table = `<h2>${category}</h2><table border="1"><thead><tr><th>Region</th><th>Average</th><th>Min</th><th>Max</th></tr></thead><tbody>`;
        
        for (const region in categorizedPrices[category]) {
            const regionData = categorizedPrices[category][region];
            regionData.average = regionData.total / regionData.count;
            table += `<tr><td>${region}</td><td>${regionData.average.toFixed(2)}</td><td>${regionData.min}</td><td>${regionData.max}</td></tr>`;
        }

        table += '</tbody></table><br>';
        html += table;
    }

    return html;
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
        to: process.env.MAILING_LIST, // Comma-separated list of recipient emails
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
