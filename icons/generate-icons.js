const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconPath = path.join(__dirname, 'icon.png');

// Ensure icons directory exists
if (!fs.existsSync(__dirname)) {
    fs.mkdirSync(__dirname);
}

// Generate icons for each size
sizes.forEach(size => {
    sharp(iconPath)
        .resize(size, size)
        .toFile(path.join(__dirname, `icon-${size}x${size}.png`))
        .then(() => console.log(`Generated ${size}x${size} icon`))
        .catch(err => console.error(`Error generating ${size}x${size} icon:`, err));
});
