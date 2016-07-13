# bbbmyadmin

![Logo de bbbmyadmin](app/public/images/logo.svg)

bbbmyadmin es un administrador de la plataforma BigBlueButton con soporte de salas,
usuarios, roles y clases hecho en NodeJS.

## Instalando

Instale todas las dependencias de bbbmyadmin (estas estan en `app/package.json`) y luego ejecute
el archivo `mysqlinit.sql` con su cliente MySQL para crear la base de datos, luego ejecute:

```
cd app/
npm start
```

Para conectarse a su servidor predeterminado:
[http://localhost:4567/](http://localhost:4567/ "Servidor predeterminado de bbbmyadmin").

## Usando

De manera predeterminada, bbbmyadmin posee 3 usuarios: `user`, `mod` y `admin`.

* `admin` puede ingresar, crear y cerrar salas, crear, cancelar, modificar y borrar usuarios y
  editar la configuración.
* `mod` puede ingresar, crear y cerrar salas.
* `user` solo puede ingresar a salas.

## Licencia

MIT License

Copyright (c) 2016 Alejandro Linarez Rangel

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
