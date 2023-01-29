import { createScaleMatrix, createTranslateMatrix, multiply } from "./code/matrix";
import { webGlCreateShader, webglCreateProgram } from "./code/webgl";


let gl: WebGL2RenderingContext;
let globalPrograms: {
    triangleProgram: WebGLProgram;
    textProgram: WebGLProgram;
}
let globalTriangleProgramData: TriangleProgramData;
let globalTextProgramData: TextProgramData;
let globalImage: HTMLImageElement;

let globalStrVerticesData: {
    vertices: Float32Array;
    textureCoords: Float32Array;
    verticesCount: number;
};
const globalTextScale = 4;
const globalTextTranslate = 100;
let globalMat = multiply(createTranslateMatrix(globalTextTranslate, globalTextTranslate), createScaleMatrix(globalTextScale, globalTextScale));

// Loop
let globalRunning = true;
let globalPrevTime: DOMHighResTimeStamp = 0;

// Resize
let globalResizeObserver: ResizeObserver;
let globalNeedResize = false;
let globalCanvasWidth = 0;
let globalCanvasHeight = 0;

// Input
let globalStr = 'Hello world';
const globalInputs = {
}

// Webgl Context
// let globalCanvasResolutionLocation: WebGLUniformLocation | null;
// let globalTranslationMatrixLocation: WebGLUniformLocation | null;
// let globalTransformationMatrix = [
//     0, 0, 0,
//     0, 0, 0,
//     0, 0, 1,
// ];

// let globalTriangleVao: WebGLVertexArrayObject | null;

// Temp
// let globalRunningAngle = 0;

interface AllPrograms {
    triangleProgram: WebGLProgram;
    textProgram: WebGLProgram;
}
function createPrograms(): AllPrograms {
    const res: Partial<AllPrograms> = {};
    const triangleVertexSrc = `#version 300 es
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

    const triangleFragmentSrc = `#version 300 es
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

    const triangleVertexShader = webGlCreateShader(gl, gl.VERTEX_SHADER, triangleVertexSrc);
    const triangleFragmentShader = webGlCreateShader(gl, gl.FRAGMENT_SHADER, triangleFragmentSrc);
    res.triangleProgram = webglCreateProgram(gl, triangleVertexShader, triangleFragmentShader);

    const textVertexSrc = `#version 300 es
    in vec2 a_position;
    in vec2 a_tex_coord;

    uniform vec2 u_canvas_resolution;
    uniform mat3 u_matrix;
    
    out vec2 v_tex_coord;

    void main() {
        vec2 new_position = (u_matrix * vec3(a_position, 1)).xy;
        // vec2 new_position = (a_position + vec2(50, 50)) * vec2(10, 10);
        // gl_Position is a special var
        gl_Position = vec4((new_position / u_canvas_resolution * 2.0f - 1.0f) * vec2(1, -1), 0, 1);
        
        v_tex_coord = a_tex_coord;
    }
    `;

    const textFragmentSrc = `#version 300 es
    precision highp float;

    in vec2 v_tex_coord;
    uniform sampler2D u_texture;

    out vec4 outColor;

    void main() {
        outColor = texture(u_texture, v_tex_coord);
    }
    `;
    const textVertexShader = webGlCreateShader(gl, gl.VERTEX_SHADER, textVertexSrc);
    const textFragmentShader = webGlCreateShader(gl, gl.FRAGMENT_SHADER, textFragmentSrc);
    res.textProgram = webglCreateProgram(gl, textVertexShader, textFragmentShader);
    return res as AllPrograms;
}

interface TriangleProgramData {
    positionBuffer: WebGLBuffer | null;
    positionVao: WebGLVertexArrayObject | null;

    canvasResolutionLoc: WebGLUniformLocation | null;
    translationMatLoc: WebGLUniformLocation | null;
}

function setupTriangleProgram(program: WebGLProgram): TriangleProgramData {
    const res: Partial<TriangleProgramData> = {};
    gl.useProgram(program);

    // Setup uniforms
    res.canvasResolutionLoc = gl.getUniformLocation(program, 'u_canvas_resolution');
    res.translationMatLoc = gl.getUniformLocation(program, 'u_translation_mat');

    // Setup attributes
    res.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, res.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,
        0, 1000,
        700, 1000,
        300, 0,
        300, 100,
        200, 0,
    ]), gl.STATIC_DRAW);

    const positionAttrLocation = gl.getAttribLocation(program, 'a_position');
    res.positionVao = gl.createVertexArray();
    gl.bindVertexArray(res.positionVao);
    gl.enableVertexAttribArray(positionAttrLocation);
    const size = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(positionAttrLocation, size, type, normalize, stride, offset);

    return res as TriangleProgramData;
}

interface TextProgramData {
    positionBuffer: WebGLBuffer | null;
    positionVao: WebGLVertexArrayObject | null;
    coordBuffer: WebGLBuffer | null;

    matrixLoc: WebGLUniformLocation | null;
    canvasResolutionLoc: WebGLUniformLocation | null;
    texture: WebGLTexture | null;
    textureLoc: WebGLUniformLocation | null;
}

function setupTextProgram(program: WebGLProgram): TextProgramData {
    const res: Partial<TextProgramData> = {};
    gl.useProgram(program);

    // Buffers
    // TODO unassert
    res.positionBuffer = gl.createBuffer()!;
    res.coordBuffer = gl.createBuffer()!;

    // Uniforms
    res.matrixLoc = gl.getUniformLocation(program, 'u_matrix');
    res.canvasResolutionLoc = gl.getUniformLocation(program, 'u_canvas_resolution');
    res.textureLoc = gl.getUniformLocation(program, 'u_texture');

    return res as TextProgramData;
}



function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
    // Get the size the browser is displaying the canvas in device pixels.
    // Check if the canvas is not the same size.
    if (globalNeedResize) {
        // Make the canvas the same size
        canvas.width  = globalCanvasWidth;
        canvas.height = globalCanvasHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        globalNeedResize = false;

        globalStrVerticesData = createStringVertices(globalStr, globalFontInfo);

        gl.useProgram(globalPrograms.textProgram);
        // DO THIS AT RENDER TIME
        gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.vertices, gl.STATIC_DRAW);

        gl.useProgram(globalPrograms.textProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.coordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.textureCoords, gl.STATIC_DRAW);
    }
}

function handleResize(entries: ResizeObserverEntry[]) {
    // devicePixelContentBoxSize is the most accurate, everything else isn't ideal
    // see https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
    const entry = entries[0];
    let width: number;
    let height: number;
    // dpr is device zoom level
    let dpr = window.devicePixelRatio;
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
    const key = e.key;
    globalInputs[key] = true;
    console.log('down', key);
    if (key.length === 1) {
        globalStr += key === '\\' ? '\\\\' : e.key;
    } else {
        switch (key) {
            case 'Backspace': {
                globalStr = globalStr.slice(0, globalStr.length-1);
            } break;
            case 'Enter': {
                globalStr += '\n';
            } break;
        }
    }
    globalStrVerticesData = createStringVertices(globalStr, globalFontInfo);

    // TODO make this a function
    gl.useProgram(globalPrograms.textProgram);
    // DO THIS AT RENDER TIME
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.vertices, gl.STATIC_DRAW);

    gl.useProgram(globalPrograms.textProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.coordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.textureCoords, gl.STATIC_DRAW);
}

function handleKeyUp(e: KeyboardEvent): void {
    globalInputs[e.key] = false;
    console.log('up', e.key);
}

function handleUnload(): void {
    globalResizeObserver.disconnect();
}

const globalFontInfo = {
    letterHeight: 8,
    spaceWidth: 4,
    spacing: -1,
    textureWidth: 64,
    textureHeight: 40,
    glyphInfos: {
        'a': { x: 0, y: 0, width: 8, },
        'b': { x: 8, y: 0, width: 8, },
        'c': { x: 16, y: 0, width: 8, },
        'd': { x: 24, y: 0, width: 8, },
        'e': { x: 32, y: 0, width: 8, },
        'f': { x: 40, y: 0, width: 8, },
        'g': { x: 48, y: 0, width: 8, },
        'h': { x: 56, y: 0, width: 8, },
        'i': { x: 0, y: 8, width: 8, },
        'j': { x: 8, y: 8, width: 8, },
        'k': { x: 16, y: 8, width: 8, },
        'l': { x: 24, y: 8, width: 8, },
        'm': { x: 32, y: 8, width: 8, },
        'n': { x: 40, y: 8, width: 8, },
        'o': { x: 48, y: 8, width: 8, },
        'p': { x: 56, y: 8, width: 8, },
        'q': { x: 0, y: 16, width: 8, },
        'r': { x: 8, y: 16, width: 8, },
        's': { x: 16, y: 16, width: 8, },
        't': { x: 24, y: 16, width: 8, },
        'u': { x: 32, y: 16, width: 8, },
        'v': { x: 40, y: 16, width: 8, },
        'w': { x: 48, y: 16, width: 8, },
        'x': { x: 56, y: 16, width: 8, },
        'y': { x: 0, y: 24, width: 8, },
        'z': { x: 8, y: 24, width: 8, },
        '0': { x: 16, y: 24, width: 8, },
        '1': { x: 24, y: 24, width: 8, },
        '2': { x: 32, y: 24, width: 8, },
        '3': { x: 40, y: 24, width: 8, },
        '4': { x: 48, y: 24, width: 8, },
        '5': { x: 56, y: 24, width: 8, },
        '6': { x: 0, y: 32, width: 8, },
        '7': { x: 8, y: 32, width: 8, },
        '8': { x: 16, y: 32, width: 8, },
        '9': { x: 24, y: 32, width: 8, },
        '-': { x: 32, y: 32, width: 8, },
        '*': { x: 40, y: 32, width: 8, },
        '!': { x: 48, y: 32, width: 8, },
        '?': { x: 56, y: 32, width: 8, },
    },
};

function createStringVertices(str: string, fontInfo: typeof globalFontInfo): { vertices: Float32Array; textureCoords: Float32Array; verticesCount: number; } {
    // todo make this better
    str = str.toLowerCase();
    
    // 6 vertices for x and y coords for every char in string
    const verticesArrLength = str.length * 6 * 2;
    const vertices = new Float32Array(verticesArrLength);
    const textureCoords = new Float32Array(verticesArrLength);

    // The X current width
    // The Current Index in the vertices

    // points to the current index in vertices
    let runningVerticesIndex = 0;
    // this is the beginning x coord of the glyph
    let left = 0;
    let top = 0;

    // todo double check this
    let effectiveCanvasWidth = globalCanvasWidth / globalTextScale - globalTextTranslate;
    effectiveCanvasWidth = effectiveCanvasWidth < 0 ? 0 : effectiveCanvasWidth;
    
    for (let i = 0; i<str.length; i++) {
        if (left >= effectiveCanvasWidth) {
            left = 0;
            top += fontInfo.letterHeight;
        }
        const char: string = str[i];
        if (char === '\n') {
            top += fontInfo.letterHeight;
            left = 0;
            continue;
        }
        const glyphMetadata: {
            x: number; y: number; width: number;
        } = fontInfo.glyphInfos[char];

        if (glyphMetadata) {
            let right = left + glyphMetadata.width;
            let bottom = top + fontInfo.letterHeight;

            const u1 = glyphMetadata.x / fontInfo.textureWidth;
            const u2 = (glyphMetadata.x + glyphMetadata.width - 1) / fontInfo.textureWidth;
            const v1 = glyphMetadata.y / fontInfo.textureHeight;
            const v2 = (glyphMetadata.y + fontInfo.letterHeight -1) / fontInfo.textureHeight;
            
            // quad:
            // a b
            // c d

            // Triangle 1
            // a
            vertices[runningVerticesIndex] = left;
            vertices[runningVerticesIndex + 1] = top;
            textureCoords[runningVerticesIndex] = u1;
            textureCoords[runningVerticesIndex + 1] = v1;

            // c
            vertices[runningVerticesIndex + 2] = left;
            vertices[runningVerticesIndex + 3] = bottom;
            textureCoords[runningVerticesIndex + 2] = u1;
            textureCoords[runningVerticesIndex + 3] = v2;


            // d
            vertices[runningVerticesIndex + 4] = right;
            vertices[runningVerticesIndex + 5] = bottom;
            textureCoords[runningVerticesIndex + 4] = u2;
            textureCoords[runningVerticesIndex + 5] = v2;

            // Triangle 2
            // a
            vertices[runningVerticesIndex + 6] = left;
            vertices[runningVerticesIndex + 7] = top;
            textureCoords[runningVerticesIndex + 6] = u1;
            textureCoords[runningVerticesIndex + 7] = v1;

            // b
            vertices[runningVerticesIndex + 8] = right;
            vertices[runningVerticesIndex + 9] = top;
            textureCoords[runningVerticesIndex + 8] = u2;
            textureCoords[runningVerticesIndex + 9] = v1;

            // d
            vertices[runningVerticesIndex + 10] = right;
            vertices[runningVerticesIndex + 11] = bottom;
            textureCoords[runningVerticesIndex + 10] = u2;
            textureCoords[runningVerticesIndex + 11] = v2;

            // update the running values
            left = right + fontInfo.spaceWidth;
            runningVerticesIndex += 12;
        } else {
            left += fontInfo.spaceWidth * 2;
        }
    }

    return { vertices, textureCoords, verticesCount: runningVerticesIndex / 2 };
}

function loop(time: DOMHighResTimeStamp) {
    const elapsedTime = time - globalPrevTime;
    resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);

    // gl.useProgram(globalTriangleProgram);

    // // clear the canvas
    // gl.clearColor(1, 1, 0, 0);
    // gl.clear(gl.COLOR_BUFFER_BIT);

    // // [
    // //     c, -s, 0,
    // //     s, c, 0,
    // //     0, 0, 1,
    // // ];
    // globalRunningAngle += elapsedTime / 10000;
    // globalRunningAngle %= Math.PI * 2;
    // const c = Math.cos(globalRunningAngle * Math.PI);
    // const s = Math.sin(globalRunningAngle * Math.PI);
    // globalTransformationMatrix[0] = c;
    // globalTransformationMatrix[1] = -s;
    // globalTransformationMatrix[3] = s;
    // globalTransformationMatrix[4] = c;

    // gl.bindVertexArray(globalTriangleVao);

    // gl.uniform2f(globalCanvasResolutionLocation, gl.canvas.width, gl.canvas.height);
    // gl.uniformMatrix3fv(globalTranslationMatrixLocation, false, globalTransformationMatrix);

    // const primitiveType = gl.TRIANGLES;
    // const offset = 0;
    // const count = 6;
    // gl.drawArrays(primitiveType, offset, count);

    // DRAW TEXT
    {
        gl.useProgram(globalPrograms.textProgram);
        
        gl.bindVertexArray(globalTextProgramData.positionVao);
        
        gl.uniform2f(globalTextProgramData.canvasResolutionLoc, gl.canvas.width, gl.canvas.height);
        gl.uniformMatrix3fv(globalTextProgramData.matrixLoc, false, globalMat);
        gl.uniform1i(globalTextProgramData.textureLoc, 0);


        gl.drawArrays(gl.TRIANGLES, 0, globalStrVerticesData.verticesCount);
    }

    globalPrevTime = time;
    if (globalRunning) {
        window.requestAnimationFrame(loop);
    }
}

// TODO check if e.target is applicable over global image var
function resumeWebGlSetup(e: Event): void {
    globalPrograms = createPrograms();
    globalTriangleProgramData = setupTriangleProgram(globalPrograms.triangleProgram);
    globalTextProgramData = setupTextProgram(globalPrograms.textProgram);
    gl.useProgram(globalPrograms.textProgram);

    globalTextProgramData.texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + 0);
    // old code for loading in one pixel texture
    // gl.bindTexture(gl.TEXTURE_2D, globalTextProgramData.texture);
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    
    gl.bindTexture(gl.TEXTURE_2D, globalTextProgramData.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, globalImage);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // positions
    gl.useProgram(globalPrograms.textProgram);
    // DO THIS AT RENDER TIME
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.vertices, gl.STATIC_DRAW);

    const positionAttrLocation = gl.getAttribLocation(globalPrograms.textProgram, 'a_position');
    globalTextProgramData.positionVao = gl.createVertexArray();
    gl.bindVertexArray(globalTextProgramData.positionVao);
    gl.enableVertexAttribArray(positionAttrLocation);
    gl.vertexAttribPointer(positionAttrLocation, 2, gl.FLOAT, false, 0, 0);

    // texture coords
    gl.useProgram(globalPrograms.textProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, globalTextProgramData.coordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, globalStrVerticesData.textureCoords, gl.STATIC_DRAW);

    const location = gl.getAttribLocation(globalPrograms.textProgram, 'a_tex_coord');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

    // Start Loop
    window.requestAnimationFrame(loop);
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
    globalCanvasWidth = canvas.clientWidth;
    globalCanvasHeight = canvas.clientHeight;
    if (!globalCanvasWidth) throw "THe canvas has no width";

    gl = canvas.getContext('webgl2')!;
    
    // Start data prep
    globalStrVerticesData = createStringVertices(globalStr, globalFontInfo);
    
    globalImage = new Image();
    globalImage.src = "./8x8-font.png";
    globalImage.addEventListener('load', resumeWebGlSetup);

    // Create ResizeObserver
    // TODO resizing the canvas seems laggy, debug
    globalResizeObserver = new ResizeObserver(handleResize);
    globalResizeObserver.observe(gl.canvas as HTMLCanvasElement, {box: 'content-box'});
    window.addEventListener('beforeunload', handleUnload);

    // Input
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
}

main();
