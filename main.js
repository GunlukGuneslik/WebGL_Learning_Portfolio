var gl;
var canvas;
var gridResolution = 20; // lets say out default grid size is 20x20
var gridData = []; // this is for cell datas, it is goig to be a matric rox x col
var GridLinevertices = []; // this is for drawing the grid lines
var FilledCellVertices = []; // this is for pixel fills
var softFillVertices = []; // this fill will use marching square algorithm during the fill as well
var cursorOutlineVertices = [];
var cursorInnerSymbolVertices = [];
var marchingSquareVertices = [];

var zoom = 1.0; // Obviously there will be no zoom by default.
var cameraX = 0.0;
var cameraY = 0.0;

var uColor; // i need this here to set it public
var vPosition; // i need this here to set it public
var uZoom; 
var uCamera;

var gridLineBuffer;
var filledCellBuffer;
var softFillBuffer;
var cursorOutlineBuffer;
var cursorInnerSymbolBuffer;
var marchingSquareBuffer;

var FillColor = vec4(0.0, 0.0, 0.0, 0.8); // defaultColor.
var ContourColor = vec4(0.0, 0.0, 0.0, 1.0); // default contour colour
var gridLineColour = vec4 (0.0, 0.0, 0.0, 0.5);
var isDrawing = false;
var isBrushSelected = true;
var isZoomOut = false;
var isZoomIn = false;

var isFillVisible = true;
var isSoftFillVisible = false;
var isMarchingSquareVisible = false;

var brushType = "Square"; // default brush type is square

var brushThikness = 1; // default brush thikness
var BrushPixelSize = 0.1;
var contourThicknessValue = 5;

// to make undo redo etc.
var drawLog = [];
var drawLogIndex = -1;

// for linear interpolation
var prevMouseX = null;
var prevMouseY = null;

// Buttons
var CircleBrushButton;
var SquareBrushButton;
var PixelBrushButton;
var SoftBrushButton;
var ZoomInButton;
var ZoomOutButton;

/**
 * Changes all selection button's colour to white
 * makes all bools related with a state equal to false
 */
function unselectAllButtons() {
    CircleBrushButton.style.backgroundColor = "white";
    SquareBrushButton.style.backgroundColor = "white";
    CircleBrushButton.style.backgroundColor = "white";
    SquareBrushButton.style.backgroundColor = "white";
    isBrushSelected = false;

    ZoomInButton.style.backgroundColor = "white";
    isZoomIn = false;

    ZoomOutButton.style.backgroundColor = "white";
    isZoomOut = false;
}

/**
 * makes zoom = 1, and centeralize the grid.
 */
function resetZoom() {
    zoom = 1;
    gl.uniform1f(uZoom,zoom);
    document.getElementById("currentZoomText").innerText = zoom; // aslo show it.
    // unselec t the zoom settings.
    isZoomIn = false;
    ZoomInButton.style.backgroundColor = "white";
    isZoomOut = false;
    ZoomOutButton.style.backgroundColor = "white";
    
    cameraX = 0.0;
    cameraY = 0.0;
    gl.uniform2f(uCamera, cameraX, cameraY);
}

function reset() {
    gridResolution = parseInt(document.getElementById("GridResolutionSlider").value);
    initializeGrid();

    // clean existing work
    FilledCellVertices = [];
    gl.bindBuffer(gl.ARRAY_BUFFER, filledCellBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(FilledCellVertices), gl.DYNAMIC_DRAW);

    marchingSquareVertices = [];
    gl.bindBuffer(gl.ARRAY_BUFFER, marchingSquareBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(marchingSquareVertices), gl.DYNAMIC_DRAW);

    softFillVertices = [];
    gl.bindBuffer(gl.ARRAY_BUFFER, softFillBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(softFillVertices), gl.DYNAMIC_DRAW);

    generateGridVertices();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(GridLinevertices), gl.DYNAMIC_DRAW);
    
    // all view should be reset in here.
    resetZoom();
}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    // Find Buttons
    CircleBrushButton = document.getElementById("CircleBrushButton");
    SquareBrushButton = document.getElementById("SquareBrushButton");
    ZoomInButton = document.getElementById("ZoomInButton");
    ZoomOutButton = document.getElementById("ZoomOutButton");


//################## This part for input events ####################

    // I needed draw function because other wise i couldnt draw in here.
    canvas.addEventListener("mousedown", function(event) {

        if (event.button !== 0) return;

        if (isBrushSelected) {
            isDrawing = true;

            var rect = canvas.getBoundingClientRect();

            // need to update prev positions
            prevMouseX = canvas.width / 2
                + (((event.clientX - rect.left) * canvas.width / rect.width) - canvas.width / 2) / zoom
                + cameraX * canvas.width / 2;

            prevMouseY = (event.clientY - rect.top)
                    * canvas.height / rect.height;

            prevMouseY = canvas.height / 2
                    + (((event.clientY - rect.top) * canvas.height / rect.height) - canvas.height / 2) / zoom
                    - cameraY * canvas.height / 2;

            Draw(event);
        } else if (isZoomIn) {
            if (zoom < 6) {
                zoom = zoom + 1;
                document.getElementById("currentZoomText").innerText = zoom;

                var rect = canvas.getBoundingClientRect();
                var clipX = -1 + 2 * (event.clientX  - rect.left) / rect.width;
                var clipY = 1 - 2 * (event.clientY - rect.top) / rect.height;

                // to not go beyond the boundary
                var maxCameraOffset = Math.max(0, 1 - 1 / zoom);

                cameraX = Math.max(-maxCameraOffset, 
                    Math.min(maxCameraOffset, cameraX + clipX / zoom));
                cameraY = Math.max(-maxCameraOffset, 
                    Math.min(maxCameraOffset, cameraX + clipY / zoom));
                
                if (zoom >= 6) {
                    unselectAllButtons();
                    cursorInnerSymbolVertices = [];
                    cursorOutlineVertices = [];
                    render();
                    return;
                }

                generateZoomOutline(event, true);
            }
        } else if (isZoomOut) {

            if (zoom > 1) {
                zoom = zoom - 1;
                document.getElementById("currentZoomText").innerText = zoom;

                var rect = canvas.getBoundingClientRect();
                var clipX = -1 + 2 * (event.clientX  - rect.left) / rect.width;
                var clipY = 1 - 2 * (event.clientY - rect.top) / rect.height;

                // to not go beyond the boundary
                var maxCameraOffset = Math.max(0, 1 - 1 / zoom);

                cameraX = Math.max(-maxCameraOffset, 
                    Math.min(maxCameraOffset, cameraX + clipX / zoom));
                cameraY = Math.max(-maxCameraOffset, 
                    Math.min(maxCameraOffset, cameraY + clipY / zoom));
                
                if (zoom <= 1) {
                    unselectAllButtons();

                    cursorOutlineVertices = [];
                    cursorInnerSymbolVertices = [];

                    // We need to center it when there is no zoom out.
                    cameraX = 0.0;
                    cameraY = 0.0;

                    render();
                    return;
                }
            }

            generateZoomOutline(event, false);
            /*
            unselectAllButtons();

            // We need to center it when there is no zoom out.
            cameraX = 0.0;
            cameraY = 0.0;
            render();
            */
        }
    });

    window.addEventListener("mouseup", function(event){
        // save the actions
        if (isDrawing) {
            isDrawing = false;
            saveDrawLogState();
        }

        isDrawing = false;
        prevMouseX = null;
        prevMouseY = null;

        if (isZoomIn || isZoomOut) {
            generateZoomOutline(event, isZoomIn);
        }
    });

    // I add this because whenever curser goes beyond the canvas drawing must stop.
    canvas.addEventListener("mouseleave", function(event) {
        if (isDrawing) {
            Draw(event);
            isDrawing = false;
            // save the actions
            saveDrawLogState();

            prevMouseX = null;
            prevMouseY = null;
        }

        // we need to clean the cursor outline.
        cursorOutlineVertices = [];
        cursorInnerSymbolVertices = [];
        render();
    });

    canvas.addEventListener("mousemove", function(event) {
        if (isDrawing) {
            generateBrushOutline(event);
            Draw(event);
        }

        if (isBrushSelected) {
            generateBrushOutline(event);
        }

        if (isZoomIn) {
            generateZoomOutline(event, true);
        } else if (isZoomOut) {
            generateZoomOutline(event, false);
        }
    });

// End part for mouse events ####################

    document.getElementById("FillColourMenu").onchange = function( event) {
            switch(event.target.value) {
            case "Black":
                FillColor = vec4(0.0, 0.0, 0.0, 0.8);
                break;
            case "Red":
                FillColor = vec4(1.0, 0.0, 0.0, 0.8);
                break;

            case "Green":
                FillColor = vec4(0.0, 1.0, 0.0, 0.8);
                break;

            case "Blue":
                FillColor = vec4(0.0, 0.0, 1.0, 0.8);
                break;
        }

        render();
    };

    CircleBrushButton.onclick = function() {
        if (isBrushSelected && brushType == "Circle") {
            unselectAllButtons();
            return;
        }

        unselectAllButtons();

        isBrushSelected = true;
        brushType = "Circle";
        this.style.backgroundColor = "lightgray";
        render();
    }

    SquareBrushButton.onclick = function() {
        if (isBrushSelected && brushType == "Square") {
            unselectAllButtons();
            return;
        }

        unselectAllButtons();

        isBrushSelected = true;
        brushType = "Square";
        this.style.backgroundColor = "lightgray";
        render();
    }

    document.getElementById("ThicnessSlider").oninput = function(event) {
        brushThikness = parseInt(event.target.value);
        document.getElementById("thicknessValue").innerText = brushThikness;
        render();
    }

    document.getElementById("ContourThicknessSlider").oninput = function(event) {
        contourThicknessValue = parseInt(event.target.value);
        document.getElementById("ContourThicknessValue").innerText = contourThicknessValue;
        generateMarchingSquareLines();
        render();
    }

    // just change the visible value
    document.getElementById("GridResolutionSlider").oninput = function(event) {
        document.getElementById("GridResolutionValue").innerText = parseInt(event.target.value);
    }

    document.getElementById("ApplyGridResolutionButton").onclick = function() {
        //saveDrawLogState();
        reset();
        // clean the draw log
        drawLog = [];
        drawLogIndex = -1;
        saveDrawLogState();
        render();
    }

    ZoomInButton.onclick = function() {
        if (isZoomIn) {
            unselectAllButtons();
            return;
        }

        if (zoom >= 6) {
            unselectAllButtons();
            alert("Min zoom is reached!");
            return;
        }

        unselectAllButtons();
        isZoomIn = true;
        this.style.backgroundColor = "lightgray";
    }

    ZoomOutButton.onclick = function() {
        if (isZoomOut) {
            unselectAllButtons();
            return;
        }

        if (zoom <= 1) {
            unselectAllButtons();
            alert("Max zoom is reached!");
            return;
        }

        unselectAllButtons();
        isZoomOut = true;
        this.style.backgroundColor = "lightgray";
    }

    document.getElementById("ZoomResetButton").onclick = function () {
        resetZoom();
        render();
    }

    window.addEventListener("keydown", function(event) {

        var panStep = 0.1 / zoom;
        var maxCameraOffset = 1 - 1 / zoom;

        switch (event.key) {
            case "ArrowLeft":
                cameraX = Math.max(-maxCameraOffset, cameraX - panStep);
                break;

            case "ArrowRight":
                cameraX = Math.min(maxCameraOffset, cameraX + panStep);
                break;

            case "ArrowUp":
                cameraY = Math.min(maxCameraOffset, cameraY + panStep);
                break;

            case "ArrowDown":
                cameraY = Math.max(-maxCameraOffset, cameraY - panStep);
                break;

            default:
                return;
        }

        event.preventDefault(); // other wise viewport scrolls.
        render();
    });

    document.getElementById("FilledSpaceButton").onclick = function() {
        if (isFillVisible) {
            isFillVisible = false;
            this.style.backgroundColor = "white";
            render();
            return;
        }

        this.style.backgroundColor = "lightgray";
        isFillVisible = true;
        render();
    }

    document.getElementById("ContorusButton").onclick = function () {
        if (isMarchingSquareVisible) {
            isMarchingSquareVisible = false;
            this.style.backgroundColor = "white";
            render();
            return;
        }

        this.style.backgroundColor = "lightgray";
        isMarchingSquareVisible = true;
        render();
    }

    document.getElementById("ContourColourMenu").onchange = function( event) {
        switch(event.target.value) {
        case "Black":
            ContourColor = vec4(0.0, 0.0, 0.0, 1.0);
            break;
        case "Red":
            ContourColor = vec4(1.0, 0.0, 0.0, 1.0);
            break;

        case "Green":
            ContourColor = vec4(0.0, 1.0, 0.0, 1.0);
            break;

        case "Blue":
            ContourColor = vec4(0.0, 0.0, 1.0, 1.0);
            break;
        }

        render();
    };

    document.getElementById("GridLineColourMenu").onchange = function(event) {
        switch(event.target.value) {
            case "Black":
                gridLineColour = vec4(0.0, 0.0, 0.0, 0.5);
                break;
            case "Red":
                gridLineColour = vec4(1.0, 0.0, 0.0, 0.5);
                break;

            case "Green":
                gridLineColour = vec4(0.0, 1.0, 0.0, 0.5);
                break;

            case "Blue":
                gridLineColour = vec4(0.0, 0.0, 1.0, 0.5);
                break;
        }

        render();
    }

    document.getElementById("UndoButton").onclick = function() {
        undo();
    }

    document.getElementById("RedoButton").onclick = function() {
        redo();
    }

    document.getElementById("ResetButton").onclick = function () {
        reset();

        // clean the draw log
        drawLog = [];
        drawLogIndex = -1;
        saveDrawLogState();

        render();
    }

    document.getElementById("SaveButton").onclick = function() {
        saveDrawing();
    };

    document.getElementById("LoadButton").onclick = function() {
        document.getElementById("LoadFileInput").click();
    };

    document.getElementById("LoadFileInput").onchange = async function(event) {
        var file = event.target.files[0];

        if (!file) {
            return;
        }

        var jsonText = await file.text();

        loadDrawing(jsonText);

        event.target.value = "";
    };

    document.getElementById("SoftFillButton").onclick = function() {
        if (isSoftFillVisible) {
            isSoftFillVisible = false;
            this.style.backgroundColor = "white";
            render();
            return;
        }

        this.style.backgroundColor = "lightgray";
        isSoftFillVisible = true;
        generateMarchingSquareLines();
        render();
    }

//################## This part for Colour Selections ####################


// End part for Colour Selections ####################

    // for grid cells' data
    initializeGrid();

    // draw log
    drawLog = [];
    drawLogIndex = -1;
    saveDrawLogState();
    
    // our canvas is here
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // prepare gridLine vertices
    generateGridVertices();
    
    // Load shaders and initialize the GPU program
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // set these
    uColor = gl.getUniformLocation(program, "uColor");

    uZoom = gl.getUniformLocation(program, "uZoom");
    gl.uniform1f(uZoom, zoom); // default values

    uCamera = gl.getUniformLocation(program, "uCamera");
    gl.uniform2f(uCamera, cameraX, cameraY); // default values
    
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.enableVertexAttribArray(vPosition);

    // Allocate a buffer on the GPU to draw grid lines.
    gridLineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(GridLinevertices), gl.DYNAMIC_DRAW);
    
    //gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);

    // Allocate a buffer on the GPU to draw filled cells.
    filledCellBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, filledCellBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(FilledCellVertices), gl.DYNAMIC_DRAW);

    //gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    
    // Allocate a buffer on the GPU to draw cursor outline.
    cursorOutlineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cursorOutlineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cursorOutlineVertices), gl.DYNAMIC_DRAW);

    // Allocate a buffer for cursor inner sybol to show plus for zoom in for example.
    cursorInnerSymbolBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,cursorInnerSymbolBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cursorInnerSymbolVertices), gl.DYNAMIC_DRAW);

    // Allocate a buffer for MarchingSquare Liness
    marchingSquareBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, marchingSquareBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(marchingSquareVertices), gl.DYNAMIC_DRAW);
    
    // Allocate a buffer for Soft Fill vertices.
    softFillBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, softFillBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(softFillVertices), gl.DYNAMIC_DRAW);

    render();
};

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    
    // we need to update them for vertex shader
    gl.uniform1f(uZoom, zoom);
    gl.uniform2f(uCamera, cameraX, cameraY);
    

    // filled space
    if (isFillVisible) {
        if (isSoftFillVisible) {
            gl.bindBuffer(gl.ARRAY_BUFFER, softFillBuffer);
            gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
            gl.uniform4f(uColor, FillColor[0], FillColor[1], FillColor[2], FillColor[3]); // FILLED CELL COLOR
            gl.drawArrays(gl.TRIANGLES, 0, softFillVertices.length);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, filledCellBuffer);
            gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
            gl.uniform4f(uColor, FillColor[0], FillColor[1], FillColor[2], FillColor[3]); // FILLED CELL COLOR
            gl.drawArrays(gl.TRIANGLES, 0, FilledCellVertices.length);
        }
    }


    // grid lines
    gl.bindBuffer(gl.ARRAY_BUFFER, gridLineBuffer);
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4f(uColor, gridLineColour[0], gridLineColour[1], gridLineColour[2], gridLineColour[3]); // LINE COLOR
    gl.drawArrays(gl.LINES, 0, GridLinevertices.length);

    // marchingSquare lines
    if (isMarchingSquareVisible) {
        gl.bindBuffer(gl.ARRAY_BUFFER, marchingSquareBuffer);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false,0,0);
        gl.uniform4f(uColor, ContourColor[0], ContourColor[1], ContourColor[2], ContourColor[3])
        // gl.drawArrays(gl.LINES, 0, marchingSquareVertices.length)
        gl.drawArrays(gl.TRIANGLES, 0, marchingSquareVertices.length)
    }
    


    // cursor outline
    gl.bindBuffer(gl.ARRAY_BUFFER, cursorOutlineBuffer);
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    if (isBrushSelected) {
        gl.uniform4f(uColor,FillColor[0], FillColor[1], FillColor[2], FillColor[3] / 2); // Cursor OUTLINE COLOR
    } else {
        gl.uniform4f(uColor, 0.5, 0.5, 0.5, 1);
    }
    gl.drawArrays(gl.LINE_LOOP, 0, cursorOutlineVertices.length);

    gl.bindBuffer(gl.ARRAY_BUFFER, cursorInnerSymbolBuffer);
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4f(uColor, 0.5, 0.5, 0.5, 1.0);
    gl.drawArrays(gl.LINES, 0, cursorInnerSymbolVertices.length);
}

/**
 * Draws the grid lines on the canvas. 
 * It generates the vertices for the grid lines based on the grid resolution and
 * stores them in the GridLinevertices array. The grid lines are drawn using 
 * WebGL's gl.LINES mode.
 */
function generateGridVertices() {

    GridLinevertices = [];

    for (let i = 0; i <= gridResolution; i++) {
        // Horizontal lines
        GridLinevertices.push(vec2(-1, 1 - i * ( 2 / gridResolution)));
        GridLinevertices.push(vec2(1, 1 - i * ( 2 / gridResolution)));
        // Vertical lines
        GridLinevertices.push(vec2(1 - i * ( 2 / gridResolution), -1));
        GridLinevertices.push(vec2(1 - i * ( 2 / gridResolution), 1));
    }
}

/**
 * Initializes the grid data structure. 
 * It creates a 2D array (grid) with dimensions
 * Also refreshes the drawLog
 */
function initializeGrid() {
    gridData = [];

    for (let row = 0; row < gridResolution; row++) {
        gridData[row] = [];

        for (let col = 0; col < gridResolution; col++) {
            gridData[row][col] = 0;
        }
    }
}

function generateFilledCellVertices(changedCells, cleanExistingVertices) {

    if (cleanExistingVertices === true) {
        FilledCellVertices = [];
    } else if (changedCells.length <= 0) {
        return;
    }

    var coef = 2 / gridResolution;

    for (let i = 0; i < changedCells.length; i++) {
        let [row, col] = changedCells[i];
        FilledCellVertices.push(vec2(col * coef - 1, 1 - row * coef)); // left top
        FilledCellVertices.push(vec2(col * coef - 1, 1 - (row + 1) * coef)); // left bottom
        FilledCellVertices.push(vec2((col + 1) * coef - 1, 1 - row * coef)); // right top
                
        FilledCellVertices.push(vec2(col * coef - 1, 1 - (row + 1) * coef)); // left bottom
        FilledCellVertices.push(vec2((col + 1) * coef - 1, 1 - (row + 1) * coef)); // right bottom                
        FilledCellVertices.push(vec2((col + 1) * coef - 1, 1 - row * coef)); // right top

    }

    // Buffer'ı seçmen lazım
    gl.bindBuffer(gl.ARRAY_BUFFER, filledCellBuffer);
    // Buffer'ın datasını update etmelisin
    gl.bufferData(gl.ARRAY_BUFFER, flatten(FilledCellVertices), gl.DYNAMIC_DRAW );
}


/**
 * This function generates verices for contour and soft brush fill. 
 * @returns 
 */
function generateMarchingSquareLines() {

    if (gridData == null || gridData.length <= 0) {
        return;
    }

    marchingSquareVertices = [];
    softFillVertices = [];

    var cellSize = 1 / gridResolution;
    var contourThickness = cellSize * contourThicknessValue / 50;

    // Perpendicular component for diagonal contours.
    var d = contourThickness / Math.sqrt(2);

    // I am taking right bottom vertex of a grid cell
    // as the center of 2 by 2 groups.
    for (var row = -1; row < gridResolution; row++) {
        for (var col = -1; col < gridResolution; col++) {

            var centerX = (1 + col) * (cellSize * 2) - 1;
            var centerY = 1 - (1 + row) * (cellSize * 2);

            var TL = (row < 0 || col < 0)
                ? 0 : gridData[row][col];

            var TR = (row < 0 || col + 1 >= gridResolution)
                ? 0 : gridData[row][col + 1];

            var BR = (row + 1 >= gridResolution ||
                      col + 1 >= gridResolution)
                ? 0 : gridData[row + 1][col + 1];

            var BL = (row + 1 >= gridResolution || col < 0)
                ? 0 : gridData[row + 1][col];

            var caseNum = TL + 2 * TR + 4 * BR + 8 * BL;

            var center = vec2(centerX, centerY);

            var top = vec2(centerX, centerY - cellSize);
            var left = vec2(centerX - cellSize, centerY);
            var right = vec2(centerX + cellSize, centerY);
            var bottom = vec2(centerX, centerY + cellSize);

            var bottomLeft = vec2(
                centerX - cellSize,
                centerY + cellSize
            );

            var bottomRight = vec2(
                centerX + cellSize,
                centerY + cellSize
            );

            var topLeft = vec2(
                centerX - cellSize,
                centerY - cellSize
            );

            var topRight = vec2(
                centerX + cellSize,
                centerY - cellSize
            );

            switch (caseNum) {

                case 0:
                    break;

                case 1:
                    // Diagonal: inward upper-left.
                    var offset = vec2(-d, d);

                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(add(left, offset));
                    marchingSquareVertices.push(add(bottom, offset));

                    marchingSquareVertices.push(add(bottom, offset));
                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(left);

                    softFillVertices.push(bottom);
                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(left);
                    break;

                case 2:
                    // Diagonal: inward upper-right.
                    var offset = vec2(d, d);

                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(add(bottom, offset));
                    marchingSquareVertices.push(add(right, offset));

                    marchingSquareVertices.push(add(right, offset));
                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(bottom);

                    softFillVertices.push(right);
                    softFillVertices.push(bottomRight);
                    softFillVertices.push(bottom);
                    break;

                case 3:
                    // Horizontal: inward upward.
                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(
                        add(right, vec2(0, contourThickness))
                    );
                    marchingSquareVertices.push(
                        add(left, vec2(0, contourThickness))
                    );

                    marchingSquareVertices.push(
                        add(left, vec2(0, contourThickness))
                    );
                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(right);

                    softFillVertices.push(left);
                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(right);

                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(right);
                    softFillVertices.push(bottomRight);
                    break;

                case 4:
                    // Diagonal: inward lower-right.
                    var offset = vec2(d, -d);

                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(add(right, offset));
                    marchingSquareVertices.push(add(top, offset));

                    marchingSquareVertices.push(add(top, offset));
                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(right);

                    softFillVertices.push(topRight);
                    softFillVertices.push(top);
                    softFillVertices.push(right);
                    break;

                case 5:
                    // First diagonal: inward upper-right.
                    var offset1 = vec2(d, d);

                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(add(top, offset1));
                    marchingSquareVertices.push(add(left, offset1));

                    marchingSquareVertices.push(add(left, offset1));
                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(top);

                    // Second diagonal: inward lower-left.
                    var offset2 = vec2(-d, -d);

                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(add(bottom, offset2));
                    marchingSquareVertices.push(add(right, offset2));

                    marchingSquareVertices.push(add(right, offset2));
                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(bottom);

                    softFillVertices.push(left);
                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(bottom);

                    softFillVertices.push(bottom);
                    softFillVertices.push(top);
                    softFillVertices.push(left);

                    softFillVertices.push(right);
                    softFillVertices.push(top);
                    softFillVertices.push(bottom);

                    softFillVertices.push(right);
                    softFillVertices.push(topRight);
                    softFillVertices.push(top);
                    break;

                case 6:
                    // Vertical: inward right.
                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(
                        add(top, vec2(contourThickness, 0))
                    );
                    marchingSquareVertices.push(bottom);

                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(
                        add(bottom, vec2(contourThickness, 0))
                    );
                    marchingSquareVertices.push(
                        add(top, vec2(contourThickness, 0))
                    );

                    softFillVertices.push(topRight);
                    softFillVertices.push(top);
                    softFillVertices.push(bottomRight);

                    softFillVertices.push(bottom);
                    softFillVertices.push(bottomRight);
                    softFillVertices.push(top);
                    break;

                case 7:
                    // Diagonal: inward upper-right.
                    var offset = vec2(d, d);

                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(add(top, offset));
                    marchingSquareVertices.push(add(left, offset));

                    marchingSquareVertices.push(add(left, offset));
                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(top);

                    softFillVertices.push(top);
                    softFillVertices.push(bottomRight);
                    softFillVertices.push(topRight);

                    softFillVertices.push(top);
                    softFillVertices.push(left);
                    softFillVertices.push(bottomRight);

                    softFillVertices.push(left);
                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(bottomRight);
                    break;

                case 8:
                    // Diagonal: inward lower-left.
                    var offset = vec2(-d, -d);

                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(add(top, offset));
                    marchingSquareVertices.push(add(left, offset));

                    marchingSquareVertices.push(add(left, offset));
                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(top);

                    softFillVertices.push(left);
                    softFillVertices.push(top);
                    softFillVertices.push(topLeft);
                    break;

                case 9:
                    // Vertical: inward left.
                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(
                        subtract(top, vec2(contourThickness, 0))
                    );
                    marchingSquareVertices.push(
                        subtract(bottom, vec2(contourThickness, 0))
                    );

                    marchingSquareVertices.push(
                        subtract(bottom, vec2(contourThickness, 0))
                    );
                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(top);

                    softFillVertices.push(top);
                    softFillVertices.push(topLeft);
                    softFillVertices.push(bottomLeft);

                    softFillVertices.push(top);
                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(bottom);
                    break;

                case 10:
                    // First diagonal: inward upper-left.
                    var offset1 = vec2(-d, d);

                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(add(top, offset1));
                    marchingSquareVertices.push(add(right, offset1));

                    marchingSquareVertices.push(add(right, offset1));
                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(top);

                    // Second diagonal: inward lower-right.
                    var offset2 = vec2(d, -d);

                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(add(left, offset2));
                    marchingSquareVertices.push(add(bottom, offset2));

                    marchingSquareVertices.push(add(bottom, offset2));
                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(left);

                    softFillVertices.push(top);
                    softFillVertices.push(topLeft);
                    softFillVertices.push(left);

                    softFillVertices.push(top);
                    softFillVertices.push(left);
                    softFillVertices.push(bottom);

                    softFillVertices.push(bottom);
                    softFillVertices.push(right);
                    softFillVertices.push(top);

                    softFillVertices.push(bottom);
                    softFillVertices.push(bottomRight);
                    softFillVertices.push(right);
                    break;

                case 11:
                    // Diagonal: inward upper-left.
                    var offset = vec2(-d, d);

                    marchingSquareVertices.push(top);
                    marchingSquareVertices.push(add(top, offset));
                    marchingSquareVertices.push(add(right, offset));

                    marchingSquareVertices.push(add(right, offset));
                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(top);

                    softFillVertices.push(top);
                    softFillVertices.push(topLeft);
                    softFillVertices.push(bottomLeft);

                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(bottomRight);
                    softFillVertices.push(top);

                    softFillVertices.push(bottomRight);
                    softFillVertices.push(right);
                    softFillVertices.push(top);
                    break;

                case 12:
                    // Horizontal: inward downward.
                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(
                        subtract(left, vec2(0, contourThickness))
                    );
                    marchingSquareVertices.push(
                        subtract(right, vec2(0, contourThickness))
                    );

                    marchingSquareVertices.push(
                        subtract(right, vec2(0, contourThickness))
                    );
                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(left);

                    softFillVertices.push(topLeft);
                    softFillVertices.push(left);
                    softFillVertices.push(topRight);

                    softFillVertices.push(topRight);
                    softFillVertices.push(left);
                    softFillVertices.push(right);
                    break;

                case 13:
                    // Diagonal: inward lower-left.
                    var offset = vec2(-d, -d);

                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(add(bottom, offset));
                    marchingSquareVertices.push(add(right, offset));

                    marchingSquareVertices.push(add(right, offset));
                    marchingSquareVertices.push(right);
                    marchingSquareVertices.push(bottom);

                    softFillVertices.push(topLeft);
                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(bottom);

                    softFillVertices.push(bottom);
                    softFillVertices.push(right);
                    softFillVertices.push(topLeft);

                    softFillVertices.push(right);
                    softFillVertices.push(topRight);
                    softFillVertices.push(topLeft);
                    break;

                case 14:
                    // Diagonal: inward lower-right.
                    var offset = vec2(d, -d);

                    marchingSquareVertices.push(left);
                    marchingSquareVertices.push(add(left, offset));
                    marchingSquareVertices.push(add(bottom, offset));

                    marchingSquareVertices.push(add(bottom, offset));
                    marchingSquareVertices.push(bottom);
                    marchingSquareVertices.push(left);

                    softFillVertices.push(left);
                    softFillVertices.push(topRight);
                    softFillVertices.push(topLeft);

                    softFillVertices.push(left);
                    softFillVertices.push(topRight);
                    softFillVertices.push(bottomRight);

                    softFillVertices.push(left);
                    softFillVertices.push(bottomRight);
                    softFillVertices.push(bottom);
                    break;

                case 15:
                    softFillVertices.push(topLeft);
                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(topRight);

                    softFillVertices.push(bottomLeft);
                    softFillVertices.push(bottomRight);
                    softFillVertices.push(topRight);
                    break;
            }
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, marchingSquareBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        flatten(marchingSquareVertices),
        gl.DYNAMIC_DRAW
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, softFillBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        flatten(softFillVertices),
        gl.DYNAMIC_DRAW
    );
}




/**
 * To show brush outline with brush colour.
 */
function generateBrushOutline(event){
    cursorOutlineVertices = []; // clean it first
    cursorInnerSymbolVertices = []; // there is no symbol thouygh

    // Buffer'ı seçmen lazım
    gl.bindBuffer(gl.ARRAY_BUFFER, cursorInnerSymbolBuffer);
    // Buffer'ın datasını update etmelisin
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cursorInnerSymbolVertices), gl.DYNAMIC_DRAW );
    

    // first the mouse position
    var rect = canvas.getBoundingClientRect();
    var ClipX = 2 * (event.clientX - rect.left) / rect.width - 1;
    var ClipY = 1 - 2 * (event.clientY - rect.top) / rect.height;

    var worldX = cameraX + ClipX / zoom;
    var worldY = cameraY + ClipY / zoom;

    var brushSize = brushThikness * BrushPixelSize / 2; 


    switch(brushType) {
        case "Square":
            cursorOutlineVertices.push(vec2(worldX - brushSize, worldY + brushSize)); // left top
            cursorOutlineVertices.push(vec2(worldX - brushSize, worldY - brushSize)); // left bottom
            cursorOutlineVertices.push(vec2(worldX + brushSize, worldY - brushSize)); // right bottom
            cursorOutlineVertices.push(vec2(worldX + brushSize, worldY + brushSize)); // right top
            break;
        case "Circle":
            for (let i = 0; i < 100; i++) {
                let angle = i * 2 * Math.PI / 100;
                cursorOutlineVertices.push(vec2(worldX + brushSize * Math.cos(angle), 
                    worldY + brushSize * Math.sin(angle)));
            }
            break;
    }

    // Buffer'ı seçmen lazım
    gl.bindBuffer(gl.ARRAY_BUFFER, cursorOutlineBuffer);
    // Buffer'ın datasını update etmelisin
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cursorOutlineVertices), gl.DYNAMIC_DRAW );
    render();
}

/**
 * to show zoom target
 * @param {*} event 
 * @param {boolean} isZoomIn 
 */
function generateZoomOutline(event, isZoomIn) {
    cursorOutlineVertices = []; // clean it first
    cursorInnerSymbolVertices = [];

    // first the mouse position
    var rect = canvas.getBoundingClientRect();
    var ClipX = 2 * (event.clientX - rect.left) / rect.width - 1;
    var ClipY = 1 - 2 * (event.clientY - rect.top) / rect.height;

    var worldX = cameraX + ClipX / zoom;
    var worldY = cameraY + ClipY / zoom;

    cursorInnerSymbolVertices.push(vec2(worldX - (0.07 / zoom), worldY));
    cursorInnerSymbolVertices.push(vec2(worldX + (0.07 / zoom), worldY));


    if (isZoomIn) {
        cursorInnerSymbolVertices.push(vec2(worldX, worldY - (0.07 / zoom)));
        cursorInnerSymbolVertices.push(vec2(worldX, worldY + (0.07 / zoom)));
    }
    
    // Buffer'ı seçmen lazım
    gl.bindBuffer(gl.ARRAY_BUFFER, cursorInnerSymbolBuffer);
    // Buffer'ın datasını update etmelisin
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cursorInnerSymbolVertices), gl.DYNAMIC_DRAW );

    for (let i = 0; i <= 100; i++) {
        let angle = i * 2 * Math.PI / 100;
        cursorOutlineVertices.push(vec2(worldX + (0.1 / zoom) * Math.cos(angle), 
            worldY + (0.1 / zoom) * Math.sin(angle)));
    }

    // Buffer'ı seçmen lazım
    gl.bindBuffer(gl.ARRAY_BUFFER, cursorOutlineBuffer);
    // Buffer'ın datasını update etmelisin
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cursorOutlineVertices), gl.DYNAMIC_DRAW );
    render();
}

/**
 * To draw by mouse event
 * Uses generateFilledCellVertices() without cleaning the already existing cells
 * I also added linear interpolation to make sure drawing speed do not affect the drawing.
 * @param {*} event 
 */
function Draw(event) {
    var rect = canvas.getBoundingClientRect();

    var interval = 10;

    var mouseX = canvas.width / 2
        + (((event.clientX - rect.left) * canvas.width / rect.width) - canvas.width / 2) / zoom
        + cameraX * canvas.width / 2;

    var mouseY = canvas.height / 2
        + (((event.clientY - rect.top) * canvas.height / rect.height) - canvas.height / 2) / zoom
        - cameraY * canvas.height / 2;

    var fractionX = (mouseX - prevMouseX) / interval;
    var fractionY = (mouseY - prevMouseY) / interval;
    
    var cellWidth = canvas.width / gridResolution;
    var cellHeight = canvas.height / gridResolution;

    var changedCells = [];

    var searchDistanceX = Math.floor((brushThikness * BrushPixelSize * canvas.width / 4) / cellWidth) + 1;
    var searchDistanceY = Math.floor((brushThikness * BrushPixelSize * canvas.height / 4) / cellHeight) + 1;
    for (var rowIndex = -searchDistanceY; rowIndex <= searchDistanceY; rowIndex++) {
        for (var colIndex = -searchDistanceX ; colIndex <= searchDistanceX; colIndex++) {

                // i add the interpolation also
            for (let i = 0; i <= interval; i++) {
                var currentX = prevMouseX + i * fractionX;
                var currentY = prevMouseY + i * fractionY;

                var col = Math.floor(currentX / cellWidth)  + colIndex;
                var row = Math.floor(currentY / cellHeight)+ rowIndex;

                //console.log("Now: " + row + " " + col);

                if (row >= 0 && row < gridResolution &&
                    col >= 0 && col < gridResolution) {

                    if (gridData[row][col] === 1) { continue;}

                    // Center of the candidate cell
                    var cellX = (col + 0.5) * cellWidth;
                    var cellY = (row + 0.5) * cellHeight;
                    switch(brushType) {
                        case "Square":
                            if ((Math.abs(cellX - currentX) <= brushThikness * BrushPixelSize * canvas.width / 4) && 
                            (Math.abs(cellY - currentY) <= brushThikness * BrushPixelSize * canvas.height / 4)) {
                                gridData[row][col] = 1;
                                changedCells.push([row, col]);
                            }
                            break;
                        case "Circle":
                            var distance = Math.sqrt(Math.pow(cellX - currentX, 2) + Math.pow(cellY - currentY, 2));
                            if (distance <= brushThikness * BrushPixelSize * canvas.width / 4) {
                                gridData[row][col] = 1;
                                changedCells.push([row, col]);
                            }
                            break;
                    }
                }
            }
        }
    }

    /*
    // i add the interpolation also
    for (let i = 0; i <= interval; i++) {
        var col = Math.floor((prevMouseX + i * fractionX) / cellWidth);
        var row = Math.floor((prevMouseY + i * fractionY) / cellHeight);

        console.log("Now: " + row + " " + col);

        if (row >= 0 && row < gridResolution &&
            col >= 0 && col < gridResolution) {

            if (gridData[row][col] === 1) { continue;}

            gridData[row][col] = 1;
            anyChangeHappened = true;
            
        }
    }
    */

    generateFilledCellVertices(changedCells, false);
    generateMarchingSquareLines();
    render();

    prevMouseX = mouseX;
    prevMouseY = mouseY;
    
}

function saveDrawLogState() {

    // when we make a change you cannot go forward anympre
    drawLog = drawLog.slice(0, drawLogIndex + 1);

    // save a fresh copy
    var newGridData = gridData.map(row => [...row]);

    drawLog.push(newGridData);
    drawLogIndex++;
}

function undo() {
    if (drawLogIndex <= 0) {
        return;
    }

    drawLogIndex--;

    gridData = []; // clear the data
    var changedCells = [];

    for (var row = 0; row < gridResolution; row++){
        gridData[row] = []; // clear the columns
        for(var col = 0; col < gridResolution; col++) {
            var value = drawLog[drawLogIndex][row][col];
            if (value > 0) {
                gridData[row][col] = value;
                changedCells.push(vec2(row, col));
            } else {
                gridData[row][col] = 0;
            }
        }

    }

    generateFilledCellVertices(changedCells, true);
    generateMarchingSquareLines();
    render();
}

function redo() {
    if (drawLogIndex >= drawLog.length - 1) {
        return;
    }

    drawLogIndex++;
    var changedCells = [];

    for (var row = 0; row < gridResolution; row++){
        gridData[row] = []; // clear the columns
        for(var col = 0; col < gridResolution; col++) {
            var value = drawLog[drawLogIndex][row][col];
            if (value > 0) {
                gridData[row][col] = value;
                changedCells.push(vec2(row, col));
            } else {
                gridData[row][col] = 0;
            }
        }

    }

    generateFilledCellVertices(changedCells, true);
    generateMarchingSquareLines();
    render();
}


function saveDrawing() {

    var fileName = document.getElementById("SaveFileName").value.trim();

    if (fileName === "") {
        alert("Please enter a file name.");
        return;
    }

    var saveData = {
        gridResolution: gridResolution,
        drawLog: drawLog,
        drawLogIndex: drawLogIndex,
        FillColor: FillColor,
        gridLineColour: gridLineColour
    };

    var jsonText = JSON.stringify(saveData, null, 2);

    var fileBlob = new Blob(
        [jsonText],
        { type: "application/json" }
    );

    var fileURL = URL.createObjectURL(fileBlob);

    var link = document.createElement("a");
    link.href = fileURL;

    link.download = fileName.endsWith(".json") ? fileName : fileName + ".json";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function() {
        URL.revokeObjectURL(fileURL);
    }, 1000);
}


function loadDrawing(jsonText) {

    var loadedData;

    try {
        loadedData = JSON.parse(jsonText);
    } catch (error) {
        alert("Invalid JSON file.");
        return;
    }

    var resolution = loadedData.gridResolution;
    var log = loadedData.drawLog;
    var index = loadedData.drawLogIndex;

    if (!Number.isInteger(resolution) ||
        resolution <= 0 ||
        !Array.isArray(log) ||
        log.length === 0 ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= log.length ||
        !log.every(snapshot =>
            Array.isArray(snapshot) &&
            snapshot.length === resolution &&
            snapshot.every(row =>
                Array.isArray(row) &&
                row.length === resolution &&
                row.every(value => value === 0 || value === 1)
            )
        )) {
        alert("Invalid drawing data.");
        return;
    }

    gridResolution = resolution;
    drawLog = log;
    drawLogIndex = index;

        
    if (Array.isArray(loadedData.FillColor) &&
        loadedData.FillColor.length === 4) {

        FillColor = vec4(...loadedData.FillColor);

        var fillMenu = document.getElementById("FillColourMenu");

        if (FillColor[0] === 1) {
            fillMenu.value = "Red";
        } else if (FillColor[1] === 1) {
            fillMenu.value = "Green";
        } else if (FillColor[2] === 1) {
            fillMenu.value = "Blue";
        } else {
            fillMenu.value = "Black";
        }
    }

    if (Array.isArray(loadedData.gridLineColour) &&
        loadedData.gridLineColour.length === 4) {

        gridLineColour = vec4(...loadedData.gridLineColour);

        var gridMenu = document.getElementById("GridLineColourMenu");

        if (gridLineColour[0] === 1) {
            gridMenu.value = "Red";
        } else if (gridLineColour[1] === 1) {
            gridMenu.value = "Green";
        } else if (gridLineColour[2] === 1) {
            gridMenu.value = "Blue";
        } else {
            gridMenu.value = "Black";
        }
    }


    generateGridVertices();

    var changedCells = [];

    for (var row = 0; row < gridResolution; row++){
        gridData[row] = []; // clear the columns
        for(var col = 0; col < gridResolution; col++) {
            var value = drawLog[drawLogIndex][row][col];
            if (value > 0) {
                gridData[row][col] = value;
                changedCells.push(vec2(row, col));
            } else {
                gridData[row][col] = 0;
            }
        }

    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gridLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(GridLinevertices), gl.DYNAMIC_DRAW);

    generateFilledCellVertices(changedCells, true);
    generateMarchingSquareLines();

    resetZoom();

    document.getElementById("GridResolutionSlider").value = gridResolution;
    document.getElementById("GridResolutionValue").innerText = gridResolution;

    render();
}

