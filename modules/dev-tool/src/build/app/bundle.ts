import { spawn } from 'child_process'
import { build, BuildOptions } from 'esbuild'
import fs from 'fs'
import kleur from 'kleur'
import path from 'path'

import { properties } from '../../properties'
import type { BuildApplicationOptions } from '../../types'

const cwd = path.join(__dirname, '../../../../app')

const bundlePlugins = async () => {
    const pluginsDir = path.join(__dirname, '../../../../../plugins')
    const plugins = await fs.promises.readdir(pluginsDir)

    const dist = path.join(cwd, 'dist', 'plugins')

    if (!fs.existsSync(dist)) await fs.promises.mkdir(dist)

    for (const plugin of plugins) {
        const dir = path.join(pluginsDir, plugin)
        const packageJson = JSON.parse(
            await fs.promises.readFile(path.join(dir, 'package.json'), 'utf-8'),
        )
        const files = packageJson.files || []
        const distDir = path.join(dist, packageJson.name)
        if (fs.existsSync(distDir)) await fs.promises.rm(distDir)
        await fs.promises.mkdir(distDir)
        for (const file of ['package.json', 'dist', ...files]) {
            await fs.promises.cp(path.join(dir, file), path.join(distDir, file), {
                recursive: true,
            })
        }
    }

    console.log(kleur.green('APP'), 'Bundle plugins complete')
}

export const bundleApplication = async ({ dev }: BuildApplicationOptions) => {
    const outdir = path.join(cwd, 'dist')

    if (fs.existsSync(outdir)) await fs.promises.rm(outdir, { recursive: true })

    const options: Record<'server' | 'client', BuildOptions> = {
        client: {
            entryPoints: [path.join(cwd, 'browser', 'index.tsx')],
            outfile: path.join(outdir, 'client', 'index.js'),
            external: properties['client.externals'],
            format: 'esm',
            platform: 'browser',
            bundle: true,
            sourcemap: dev,
            loader: {
                '.svg': 'text',
            },
            watch: dev
                ? {
                      onRebuild(err, result) {
                          if (err) return console.error(kleur.red('APP'), err)
                          console.log(kleur.green('APP'), result)
                      },
                  }
                : false,
            inject: [path.join(__dirname, 'shims', 'react.js')],
        },
        server: {
            entryPoints: {
                index: path.join(cwd, 'main', 'index.ts'),
                preload: path.join(cwd, 'preload', 'index.ts'),
            },
            outdir,
            external: properties['server.externals'],
            format: 'cjs',
            bundle: true,
            sourcemap: dev,
            platform: 'node',
            plugins: [
                {
                    name: 'define esbuild binary path',
                    setup(build) {
                        build.onEnd(async () => {
                            const file = path.join(outdir, 'index.js')
                            const line = `process.env['ESBUILD_BINARY_PATH']=require.resolve('esbuild-windows-64/esbuild.exe').replace('app.asar', 'app.asar.unpacked')\n`
                            const content = await fs.promises.readFile(file, 'utf8')
                            const newContent = `${line}\n${content}`
                            await fs.promises.writeFile(file, newContent)
                        })
                    },
                },
            ],
        },
    }
    try {
        await build(options.server)
        await build(options.client)
    } catch (_) {}

    await fs.promises.copyFile(
        path.join(cwd, 'browser', 'index.html'),
        path.join(outdir, 'client', 'index.html'),
    )

    console.log(kleur.green('APP'), 'Bundle complete')

    await bundlePlugins()

    if (dev)
        spawn('yarn', ['electron', 'dist/index.js', '--remote-debugging-port=9222'], {
            stdio: 'inherit',
            cwd: cwd,
            env: { ...process.env, NODE_ENV: 'development' },
        }).on('exit', process.exit)
}
