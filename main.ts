import { webGlCreateShader, webglCreateProgram } from "./code/webgl";

// Loop
let globalRunning = true;
let globalPrevTime: DOMHighResTimeStamp = 0;

// Resize
let globalResizeObserver: ResizeObserver;
let globalNeedResize = false;
let globalCanvasWidth = 0;
let globalCanvasHeight = 0;

// Input
const globalInputs = {
}

// Webgl Context
let gl: WebGL2RenderingContext;
let globalCanvasResolutionLocation: WebGLUniformLocation | null;
let globalTranslationMatrixLocation: WebGLUniformLocation | null;
let globalTransformationMatrix = [
    0, 0, 0,
    0, 0, 0,
    0, 0, 1,
];

// Temp
let globalRunningAngle = 0;

function createShaderProgram() {
    const vertexSrc = `#version 300 es
    in vec2 a_position;
    uniform vec2 u_canvas_resolution;
    uniform mat3 u_translation_mat;
    out vec4 v_color;

    void main() {
        vec2 new_position = (u_translation_mat * vec3(a_position, 1)).xy;
        // gl_Position is a special var
        gl_Position = vec4((new_position / u_canvas_resolution * 2.0f - 1.0f) * vec2(1, -1), 0, 1);
        v_color = gl_Position * 0.5 + 0.5;
    }
    `;

    const fragmentSrc = `#version 300 es
    // set default precision
    precision highp float;

    in vec4 v_color;
    // output of fragment shader
    out vec4 outColor;

    void main() {
        // output color is always red-purple
        outColor = v_color;
    }
    `;

    const vertexShader = webGlCreateShader(gl, gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = webGlCreateShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
    const program = webglCreateProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    // Setup uniforms
    globalCanvasResolutionLocation = gl.getUniformLocation(program, 'u_canvas_resolution');
    globalTranslationMatrixLocation = gl.getUniformLocation(program, 'u_translation_mat');

    // Setup attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,
        0, 1000,
        700, 1000,
        300, 0,
        300, 100,
        200, 0,
    ]), gl.STATIC_DRAW);

    const positionAttrLocation = gl.getAttribLocation(program, 'a_position');
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.enableVertexAttribArray(positionAttrLocation);

    const size = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(positionAttrLocation, size, type, normalize, stride, offset);
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
    // Get the size the browser is displaying the canvas in device pixels.
    // Check if the canvas is not the same size.
    if (globalNeedResize) {
        // Make the canvas the same size
        canvas.width  = globalCanvasWidth;
        canvas.height = globalCanvasHeight;
    }
}

function handleResize(entries: ResizeObserverEntry[]) {
    // devicePixelContentBoxSize is the most accurate, everything else isn't ideal
    // see https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
    const entry = entries[0];
    let width: number;
    let height: number;
    // dpr is device zoom level
    let dpr = window.devicePixelRatio
    console.log(entries[0].devicePixelContentBoxSize[0].inlineSize, entries[0].devicePixelContentBoxSize[0].blockSize);

    const rect = entry.devicePixelContentBoxSize?.[0];
    const fallbackRect = entry.contentBoxSize?.[0] || entry.contentBoxSize;
    if (rect) {
        width = rect.inlineSize;
        height = rect.blockSize;
        dpr = 1;
    } else if (fallbackRect) {
        width = fallbackRect.inlineSize;
        height = fallbackRect.blockSize;
    } else {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
    }
    // Set these globals
    globalCanvasWidth = Math.round(width * dpr);
    globalCanvasHeight = Math.round(height * dpr);
    globalNeedResize = true;
}

function handleKeyDown(e: KeyboardEvent): void {
    globalInputs[e.key] = true;
    // console.log('down', globalInputs);
}

function handleKeyUp(e: KeyboardEvent): void {
    globalInputs[e.key] = false;
    // console.log('up', globalInputs);
}

function handleUnload(): void {
    globalResizeObserver.disconnect();
}


function loop(time: DOMHighResTimeStamp) {
    const elapsedTime = time - globalPrevTime;
    resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // [
    //     c, -s, 0,
    //     s, c, 0,
    //     0, 0, 1,
    // ];
    globalRunningAngle += (elapsedTime / 10000) % (Math.PI * 2);
    const c = Math.cos(globalRunningAngle * Math.PI);
    const s = Math.sin(globalRunningAngle * Math.PI);
    globalTransformationMatrix[0] = c;
    globalTransformationMatrix[1] = -s;
    globalTransformationMatrix[3] = s;
    globalTransformationMatrix[4] = c;

    gl.uniform2f(globalCanvasResolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniformMatrix3fv(globalTranslationMatrixLocation, false, globalTransformationMatrix);

    const primitiveType = gl.TRIANGLES;
    const offset = 0;
    const count = 6;
    gl.drawArrays(primitiveType, offset, count);

    globalPrevTime = time;
    if (globalRunning) {
        window.requestAnimationFrame(loop);
    }
}

function main() {
    // Create Canvas
    const canvas: HTMLCanvasElement = document.createElement('CANVAS') as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    document.body.appendChild(canvas);
    // TODO double check this needs to be clientwidth
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    gl = canvas.getContext('webgl2')!;

    // Create ResizeObserver
    // TODO resizing the canvas seems laggy, debug
    globalResizeObserver = new ResizeObserver(handleResize);
    globalResizeObserver.observe(gl.canvas as HTMLCanvasElement, {box: 'content-box'});
    window.addEventListener('beforeunload', handleUnload);

    // Create Program
    createShaderProgram();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Start Loop
    window.requestAnimationFrame(loop);
}

main();
