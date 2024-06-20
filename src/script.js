let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');
let fileInput = document.getElementById('fileInput');
let loading = document.getElementById("loading");
const dropdown = document.getElementById('image_dropdown');
const loadingMessage = document.getElementById("loadingMessage");
const imgWidthText = document.getElementById("img-width");
const imgHeightText = document.getElementById("img-height");

// Show loading spinner with message
const handleLoading = (message, isLoading) => {
    if(isLoading) {
        imgWidthText.textContent = "";
        imgHeightText.textContent = "";
    }
    loadingMessage.textContent = message;
    loading.style.display = isLoading ? "block" : "none";
    canvas.style.display = isLoading ? "none" : "block";
}

handleLoading("Carregando OpenCV", true);

// Load options from dropdown
window.onload = async () => {
    const fillDropdown = () => {
        const dropdown = document.getElementById('image_dropdown');
        for (let i = 1; i <= 2; i++) {
            const option = document.createElement('option');
            option.value = `../assets/example-imgs/image_${i}.jpg`;
            option.text = `Imagem ${i}`;
            dropdown.add(option);
        }
    }

    fillDropdown();
}

// Function to be called when OpenCV.js is loaded
function onOpenCvReady() {
    handleLoading("", false);

    const processImg = (file) => {
        handleLoading("Processando imagem...", true);
        let reader = new FileReader();
        reader.onload = function (e) {
            let img = new Image();
            img.onload = function () {
                imgWidthText.textContent = `Largura: ${img.width}px`;
                imgHeightText.textContent = `Altura: ${img.height}px`;

                detectRectangle(img);
                handleLoading("", false);
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            let file = event.target.files[0];
            processImg(file);
            dropdown.value = 'none';
        }
    });

    dropdown.addEventListener("change", async (event) => {
        if (event.target.value !== 'none') {
            let res = await fetch(event.target.value);
            let file = await res.blob();
            processImg(file);
            fileInput.value = '';
        }
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

    // Draw rectangle on the image
    let color = new cv.Scalar(255, 0, 0, 255);
    cv.rectangle(src, new cv.Point(rect.x, rect.y), new cv.Point(rect.x + rect.width, rect.y + rect.height), color, 3);

    // Adjust canvas size to maintain aspect ratio
    let aspectRatio = img.width / img.height;
    if (img.width > img.height) {
        newWidth = 640;
        newHeight = 640 / aspectRatio;
    } else {
        newHeight = 480;
        newWidth = 480 * aspectRatio;
    }

    // Resize the image
    let resizedImage = new cv.Mat();
    let dsize = new cv.Size(newWidth, newHeight);
    cv.resize(src, resizedImage, dsize, 0, 0, cv.INTER_AREA);

    // Show the result on the canvas
    cv.imshow('canvas', resizedImage);

    // Cleanup
    src.delete();
    mat.delete();
    resizedImage.delete();
}
