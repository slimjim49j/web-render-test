export function webGlCreateShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error('Shader creation failed');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success: any = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
        // not familiar with what is happening here
        const infoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader creation failed: ' + infoLog);
    }
    
    return shader;
}


export function webglCreateProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = gl.createProgram();
    if (!program) {
        throw new Error('No program');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }
    const infoLog = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Program creation failed: ' + infoLog);
}
