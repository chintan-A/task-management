const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

async function convertSvgToPng() {
    const svgBuffer = await fs.readFile(path.join(__dirname, 'icon.svg'));
    await sharp(svgBuffer)
        .png()
        .toFile(path.join(__dirname, 'icon.png'));
    
    console.log('Converted SVG to PNG');
}

convertSvgToPng();
