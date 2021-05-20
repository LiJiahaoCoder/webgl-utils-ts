const ERROR_REG = /ERROR:\s*\d+:(\d+)/gi;
const addLineNumberWithError = (src: string, log = '') => {
  const matches = [...log.matchAll(ERROR_REG)];
  const lineNoToErrorMap = new Map(matches.map((match, index) => {
    const lineNumber = parseInt(match[1]);
    const next = matches[index + 1];
    const end = next ? next.index : log.length;
    const msg = log.substring(match.index ?? 0, end);

    return [lineNumber - 1, msg];
  }));

  return src.split('\n').map((line, lineNumber) => {
    const error = lineNoToErrorMap.get(lineNumber);

    return `${lineNumber + 1}: ${line}${error ? `\n\n^^^${error}` : ''}`;
  });
};

const glEnumToString = (gl: Record<string, any> & WebGLRenderingContext, value: string) => {
  const keys: string[] = [];

  Object.keys(gl).forEach((key) => {
    if (gl[key] === value) {
      keys.push(key);
    }
  });

  return keys.length ? keys.join(' | ') : value;
};

export const loadShader = (
    gl: WebGLRenderingContext,
    shaderSource: string,
    shaderType: GLenum,
) => {
  const shader = gl.createShader(shaderType);

  if (!shader) {
    throw new Error('Failed to create shader');
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    const error = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`Failed to compile shader: ${error}\n${addLineNumberWithError(shaderSource, error)}`);
  }

  return shader;
};

export const createProgram = (
    gl: WebGLRenderingContext,
    shaders: WebGLShader[],
    attributes?: string[],
    locations?: number[],
) => {
  const program = gl.createProgram();

  if (!program) {
    throw new Error('Failed to create program');
  }

  shaders.forEach((shader) => {
    gl.attachShader(program, shader);
  });

  if (attributes) {
    attributes.forEach((attribute, index) => {
      gl.bindAttribLocation(
          program,
          locations ? locations[index] : index,
          attribute,
      );
    });
  }

  gl.linkProgram(program);

  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);

    throw new Error(`Error in program linking: ${error}\n${
      shaders.map((shader) => {
        const src = addLineNumberWithError(gl.getShaderSource(shader) ?? '');
        const type = gl.getShaderParameter(shader, gl.SHADER_TYPE);

        return `${glEnumToString(gl, type)}:\n${src}`
      }).join('\n')
    }`);
  }

  return program;
};

export const createShaderFromScript = (
  gl: WebGLRenderingContext,
  scriptId: string,
  shaderType?: GLenum,
) => {
  const shaderScript = document.getElementById(scriptId) as HTMLScriptElement;
  if (!shaderScript) {
    throw new Error(`*** Error: unknown script element${scriptId}`);
  }

  if (shaderType === undefined) {
    if (shaderScript.type === 'x-shader/x-vertex') {
      shaderType = gl.VERTEX_SHADER;
    } else if (shaderScript.type === 'x-shader/x-fragment') {
      shaderType = gl.FRAGMENT_SHADER;
    } else {
      throw new Error('*** Error: unknown shader type');
    }
  }

  return loadShader(gl, shaderScript.text, shaderType);
};
