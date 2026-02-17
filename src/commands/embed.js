'use strict';

const { getDefaultModel } = require('../lib/catalog');
const { generateEmbeddings, generateMultimodalEmbeddings } = require('../lib/api');
const { resolveTextInput, readMediaAsBase64, isImageFile, isVideoFile } = require('../lib/input');
const ui = require('../lib/ui');
const { showCostSummary } = require('../lib/cost-display');

const MULTIMODAL_MODEL = 'voyage-multimodal-3.5';

/**
 * Register the embed command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerEmbed(program) {
  program
    .command('embed [text]')
    .description('Generate embeddings for text')
    .option('-m, --model <model>', 'Embedding model', getDefaultModel())
    .option('-t, --input-type <type>', 'Input type: query or document')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('-f, --file <path>', 'Read text from file')
    .option('--image <path>', 'Embed an image file (uses voyage-multimodal-3.5)')
    .option('--video <path>', 'Embed a video file (uses voyage-multimodal-3.5)')
    .option('--truncation', 'Enable truncation for long inputs')
    .option('--no-truncation', 'Disable truncation')
    .option('--output-dtype <type>', 'Output data type: float, int8, uint8, binary, ubinary', 'float')
    .option('-o, --output-format <format>', 'Output format: json or array', 'json')
    .option('--estimate', 'Show estimated tokens and cost without calling the API')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (text, opts) => {
      try {
        const telemetry = require('../lib/telemetry');
        const isMultimodal = !!(opts.image || opts.video);

        // Validate: --image/--video are incompatible with --file
        if (isMultimodal && opts.file) {
          console.error(ui.error('Cannot combine --image or --video with --file. Use --image/--video for multimodal, or --file for text.'));
          process.exit(1);
        }

        // Multimodal path: --image and/or --video
        if (isMultimodal) {
          const model = opts.model === getDefaultModel() ? MULTIMODAL_MODEL : opts.model;
          const useColor = !opts.json;
          const useSpinner = useColor && !opts.quiet;

          // Build content array
          const contentItems = [];
          const mediaMeta = [];

          // Add text if provided
          if (text) {
            contentItems.push({ type: 'text', text });
          }

          // Add image
          if (opts.image) {
            if (!isImageFile(opts.image)) {
              console.error(ui.error(`Not a supported image format: ${opts.image}`));
              process.exit(1);
            }
            const media = readMediaAsBase64(opts.image);
            contentItems.push({ type: 'image_base64', image_base64: media.base64DataUrl });
            mediaMeta.push({ type: 'image', path: opts.image, mime: media.mimeType, size: media.sizeBytes });
          }

          // Add video
          if (opts.video) {
            if (!isVideoFile(opts.video)) {
              console.error(ui.error(`Not a supported video format: ${opts.video}`));
              process.exit(1);
            }
            const media = readMediaAsBase64(opts.video);
            contentItems.push({ type: 'video_base64', video_base64: media.base64DataUrl });
            mediaMeta.push({ type: 'video', path: opts.video, mime: media.mimeType, size: media.sizeBytes });
          }

          if (contentItems.length === 0) {
            console.error(ui.error('No content provided. Pass text, --image, or --video.'));
            process.exit(1);
          }

          const done = telemetry.timer('cli_embed', {
            model,
            multimodal: true,
            hasText: !!text,
            hasImage: !!opts.image,
            hasVideo: !!opts.video,
          });

          let spin;
          if (useSpinner) {
            spin = ui.spinner('Generating multimodal embeddings...');
            spin.start();
          }

          const mmOpts = { model };
          if (opts.inputType) mmOpts.inputType = opts.inputType;
          if (opts.dimensions) mmOpts.outputDimension = opts.dimensions;

          const result = await generateMultimodalEmbeddings([contentItems], mmOpts);

          if (spin) spin.stop();

          if (opts.outputFormat === 'array') {
            console.log(JSON.stringify(result.data[0].embedding));
            return;
          }

          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          // Friendly output
          if (!opts.quiet) {
            console.log(ui.label('Model', ui.cyan(model)));
            console.log(ui.label('Mode', ui.cyan('multimodal')));
            for (const m of mediaMeta) {
              const sizeStr = m.size < 1024 * 1024
                ? `${(m.size / 1024).toFixed(1)} KB`
                : `${(m.size / (1024 * 1024)).toFixed(1)} MB`;
              console.log(ui.label(m.type === 'image' ? 'Image' : 'Video', `${m.path} ${ui.dim(`(${m.mime}, ${sizeStr})`)}`));
            }
            if (text) {
              console.log(ui.label('Text', ui.dim(text.slice(0, 80) + (text.length > 80 ? '...' : ''))));
            }
            if (result.usage) {
              console.log(ui.label('Tokens', ui.dim(String(result.usage.total_tokens))));
            }
            const dims = result.data[0]?.embedding?.length || 'N/A';
            console.log(ui.label('Dimensions', ui.bold(String(dims))));
            console.log('');
          }

          const vector = result.data[0].embedding;
          const preview = vector.slice(0, 5).map(v => v.toFixed(6)).join(', ');
          console.log(`[${preview}, ...] (${vector.length} dims)`);

          console.log('');
          console.log(ui.success('Multimodal embedding generated'));

          done({ dimensions: result.data[0]?.embedding?.length });
          return;
        }

        // Standard text embedding path
        const texts = await resolveTextInput(text, opts.file);

        // --estimate: show cost comparison, optionally switch model
        if (opts.estimate) {
          const { estimateTokensForTexts, confirmOrSwitchModel } = require('../lib/cost');
          const tokens = estimateTokensForTexts(texts);
          const chosenModel = await confirmOrSwitchModel(tokens, opts.model, { json: opts.json });
          if (!chosenModel) return; // cancelled
          opts.model = chosenModel;
        }

        const useColor = !opts.json;
        const useSpinner = useColor && !opts.quiet;

        // Show hint when --input-type is not provided and output is interactive
        if (!opts.inputType && !opts.json && !opts.quiet && process.stdout.isTTY) {
          console.error(ui.dim('ℹ Tip: Use --input-type query or --input-type document for better retrieval accuracy.'));
        }

        const done = telemetry.timer('cli_embed', {
          model: opts.model,
          inputType: opts.inputType || undefined,
          textCount: texts.length,
          outputDtype: opts.outputDtype,
        });

        let spin;
        if (useSpinner) {
          spin = ui.spinner('Generating embeddings...');
          spin.start();
        }

        const embedOpts = {
          model: opts.model,
          inputType: opts.inputType,
          dimensions: opts.dimensions,
        };
        // Only pass truncation when explicitly set via --truncation or --no-truncation
        if (opts.truncation !== undefined) {
          embedOpts.truncation = opts.truncation;
        }
        // Only pass output_dtype when not the default float
        if (opts.outputDtype && opts.outputDtype !== 'float') {
          embedOpts.outputDtype = opts.outputDtype;
        }

        const result = await generateEmbeddings(texts, embedOpts);

        if (spin) spin.stop();

        if (opts.outputFormat === 'array') {
          if (result.data.length === 1) {
            console.log(JSON.stringify(result.data[0].embedding));
          } else {
            console.log(JSON.stringify(result.data.map(d => d.embedding)));
          }
          return;
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        // Friendly output
        if (!opts.quiet) {
          console.log(ui.label('Model', ui.cyan(result.model)));
          console.log(ui.label('Texts', String(result.data.length)));
          if (result.usage) {
            console.log(ui.label('Tokens', ui.dim(String(result.usage.total_tokens))));
          }
          console.log(ui.label('Dimensions', ui.bold(String(result.data[0]?.embedding?.length || 'N/A'))));
          showCostSummary(result.model || model, result.usage?.total_tokens || 0, opts);
          console.log('');
        }

        for (const item of result.data) {
          const preview = item.embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ');
          console.log(`${ui.dim('[' + item.index + ']')} [${preview}, ...] (${item.embedding.length} dims)`);
        }

        console.log('');
        console.log(ui.success('Embeddings generated'));

        done({ dimensions: result.data[0]?.embedding?.length });
      } catch (err) {
        telemetry.send('cli_error', { command: 'embed', errorType: err.constructor.name });
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });
}

module.exports = { registerEmbed };
