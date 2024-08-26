const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const loading = document.getElementById("loading-spinner");
const dropdown = document.getElementById('image_dropdown');
const loadingMessage = document.getElementById("loadingMessage");
const downloadButton = document.getElementById("download-button");
const resetButton = document.getElementById("reset-button");

let context = canvas.getContext('2d', {willReadFrequently: true});
let startCoord;
let finalCoord;
let defaultStartCoord;
let defaultFinalCoord;
let image;
let originalImage;
let isDragging = false;
let selectedCorner;

const cornerSize = 10;

// Setup initial page configuration

// Show loading spinner with message
const handleLoading = (message, isLoading) => {
    loadingMessage.textContent = message;
    loading.style.display = isLoading ? "block" : "none";
    canvas.style.display = isLoading ? "none" : "block";
}

handleLoading("Loading OpenCV", true);

// Load options from dropdown
window.onload = async () => {
    const fillDropdown = () => {
        const dropdown = document.getElementById('image_dropdown');
        for (let i = 1; i <= 2; i++) {
            const option = document.createElement('option');
            option.value = `./assets/example-imgs/image_${i}.jpg`;
            option.text = `Image ${i}`;
            dropdown.add(option);
        }
    }

    fillDropdown();
}

// Open CV functions

// Function to be called when OpenCV.js is loaded
function onOpenCvReady() {
    handleLoading("", false);

    const processImg = (file) => {
        handleLoading("Processing image...", true);
        let reader = new FileReader();
        reader.onload = function (e) {
            originalImage = new Image();
            originalImage.onload = function () {
                detectRectangle(originalImage);
                handleLoading("", false);
                downloadButton.style.display = "block";
                resetButton.style.display = "block";
            }
            originalImage.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            downloadButton.style.display = "none";
            resetButton.style.display = "none";
            let file = event.target.files[0];
            processImg(file);
            dropdown.value = 'none';
        }
    });

    dropdown.addEventListener('change', async (event) => {
        if (event.target.value !== 'none') {
            downloadButton.style.display = "none";
            resetButton.style.display = "none";
            let res = await fetch(event.target.value);
            let file = await res.blob();
            processImg(file);
            fileInput.value = '';
        }
    });

    downloadButton.addEventListener('click', () => {
        // Calculate the width and height of the selected area
        const width = Math.abs(finalCoord.x - startCoord.x);
        const height = Math.abs(finalCoord.y - startCoord.y);

        // Calculate the scale factors
        const scaleX = originalImage.width / canvas.width;
        const scaleY = originalImage.height / canvas.height;

        // Adjust the coordinates based on the scale factors
        const adjustedStartX = startCoord.x * scaleX;
        const adjustedStartY = startCoord.y * scaleY;
        const adjustedWidth = width * scaleX;
        const adjustedHeight = height * scaleY;

        // Create a canvas to hold the cropped image
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = adjustedWidth;
        croppedCanvas.height = adjustedHeight;
        const croppedContext = croppedCanvas.getContext('2d');

        // Draw the selected area onto the cropped canvas
        croppedContext.drawImage(
            originalImage,
            adjustedStartX,
            adjustedStartY,
            adjustedWidth,
            adjustedHeight,
            0,
            0,
            adjustedWidth,
            adjustedHeight
        );

        // Download the cropped image
        const link = document.createElement('a');
        link.download = 'cropped-image.jpg';
        link.href = croppedCanvas.toDataURL('image/jpeg');
        link.click();
    });

    resetButton.addEventListener('click', () => {
        startCoord = {...defaultStartCoord};
        finalCoord = {...defaultFinalCoord};
        drawRect();
    });
}

function detectRectangle(img) {
    // Load the image into OpenCV
    let src = cv.imread(img);

    // Convert the image to grayscale
    let mat = new cv.Mat();
    cv.cvtColor(src, mat, cv.COLOR_RGBA2GRAY, 0);

    // Apply blur
    cv.blur(mat, mat, new cv.Size(5, 5));

    // Apply Canny edge detection
    cv.Canny(mat, mat, 40, 45, 3, false);

    // Morphological closing (dilate followed by erode)
    let kernel = cv.Mat.ones(10, 10, cv.CV_8U);
    for (let i = 0; i < 5; i++) {
        cv.dilate(mat, mat, kernel);
        kernel = cv.Mat.ones(11, 11, cv.CV_8U);
        cv.erode(mat, mat, kernel);
        kernel.delete();
        kernel = cv.Mat.ones(10, 10, cv.CV_8U);
    }

    let ksize = new cv.Size(60, 60); // Equivalent to applying blur 4 times with (15, 15) kernel size
    cv.blur(mat, mat, ksize);

    // Apply threshold
    cv.threshold(mat, mat, 200, 255, cv.THRESH_BINARY);

    // Get the bouding rectangle
    let rect = cv.boundingRect(mat);

    // Adjust canvas size to maintain aspect ratio
    let aspectRatio = img.width / img.height;
    let newHeight = 480;
    let newWidth = 480 * aspectRatio;

    if (img.width > img.height) {
        newWidth = 640;
        newHeight = 640 / aspectRatio;
    }

    // Resize the canvas
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Resize the image
    image = new cv.Mat();
    let dsize = new cv.Size(newWidth, newHeight);
    cv.resize(src, image, dsize, 0, 0, cv.INTER_AREA);

    // Show the result on the canvas
    cv.imshow('canvas', image);

    // Cleanup
    src.delete();
    mat.delete();
    // image.delete(); removed to keep the image on the canvas

    // Set the coordinates of the bounding rectangle
    const scaleX = newWidth / img.width;
    const scaleY = newHeight / img.height;
    startCoord = {
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY)
    };
    finalCoord = {
        x: Math.round((rect.x + rect.width) * scaleX),
        y: Math.round((rect.y + rect.height) * scaleY)
    };

    // save the default coordinates to reset the rectangle
    defaultStartCoord = {...startCoord};
    defaultFinalCoord = {...finalCoord};

    // Draw red rectangle on the image
    drawRect();
}

// Tools to resize and move the bounding rectangle

const getMouseCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    return {mouseX, mouseY};
}

function getCorner(mouseX, mouseY) {
    if (Math.abs(mouseX - startCoord.x) < cornerSize && Math.abs(mouseY - startCoord.y) < cornerSize) {
        return 'start';
    } else if (Math.abs(mouseX - finalCoord.x) < cornerSize && Math.abs(mouseY - finalCoord.y) < cornerSize) {
        return 'end';
    }
    return null;
}

function drawRect() {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    cv.imshow('canvas', image);

    // Draw the rectangle
    context.strokeStyle = 'red';
    context.lineWidth = 2;
    context.strokeRect(startCoord.x, startCoord.y, finalCoord.x - startCoord.x, finalCoord.y - startCoord.y);

    // Draw the corners
    context.fillStyle = 'blue';
    context.fillRect(startCoord.x - cornerSize / 2, startCoord.y - cornerSize / 2, cornerSize, cornerSize); // Left top corner
    context.fillRect(finalCoord.x - cornerSize / 2, finalCoord.y - cornerSize / 2, cornerSize, cornerSize); // Right bottom corner
}

const handleCanvasEvent = (e, type) => {
    e.preventDefault(); // Prevent default behavior for touch events

    let mouseX, mouseY;
    if (e.touches) {
        // Touch event
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouseX = (touch.clientX - rect.left) * (canvas.width / rect.width);
        mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    } else {
        // Mouse event
        const {mouseX: x, mouseY: y} = getMouseCoords(e);
        mouseX = x;
        mouseY = y;
    }

    if (type === 'mousedown' || type === 'touchstart') {
        selectedCorner = getCorner(mouseX, mouseY);
        if (selectedCorner) isDragging = true;
    } else if (type === 'mouseup' || type === 'mouseleave' || type === 'touchend' || type === 'touchcancel') {
        isDragging = false;
        selectedCorner = null;
    } else if ((type === 'mousemove' || type === 'touchmove') && isDragging && selectedCorner) {
        if (selectedCorner === 'start') {
            startCoord.x = mouseX;
            startCoord.y = mouseY;
        } else if (selectedCorner === 'end') {
            finalCoord.x = mouseX;
            finalCoord.y = mouseY;
        }
        drawRect();
    }
}

// Event listeners for the canvas
canvas.addEventListener('mousedown', (e) => handleCanvasEvent(e, 'mousedown'));
canvas.addEventListener('mouseup', (e) => handleCanvasEvent(e, 'mouseup'));
canvas.addEventListener('mouseleave', (e) => handleCanvasEvent(e, 'mouseleave'));
canvas.addEventListener('mousemove', (e) => handleCanvasEvent(e, 'mousemove'));

// Event listeners for touch events
canvas.addEventListener('touchstart', (e) => handleCanvasEvent(e, 'touchstart'));
canvas.addEventListener('touchend', (e) => handleCanvasEvent(e, 'touchend'));
canvas.addEventListener('touchcancel', (e) => handleCanvasEvent(e, 'touchcancel'));
canvas.addEventListener('touchmove', (e) => handleCanvasEvent(e, 'touchmove'));
