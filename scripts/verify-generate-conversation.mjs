import assert from 'node:assert/strict';
import { buildGenerateContext } from '../lib/generateConversation.ts';
const first = 'data:image/png;base64,first';
const second = 'data:image/png;base64,second';
const messages = [
  { id: '1', role: 'user', content: 'A cottage', attachments: [first] },
  { id: '2', role: 'assistant', content: 'Created', images: [second], status: 'complete' },
  { id: '3', role: 'assistant', content: 'Service failed', status: 'error' },
  { id: '4', role: 'assistant', content: '', status: 'pending' },
];
const context = buildGenerateContext(messages);
assert.deepEqual(context.images, [second, first]);
assert.match(context.prompt, /User: A cottage\n\[Attached image 2\]/);
assert.match(context.prompt, /Assistant: Created\n\[Attached image 1\]/);
assert(!context.prompt.includes('Service failed'));
assert.deepEqual(buildGenerateContext(messages, first).images, [first, second]);
assert.deepEqual(buildGenerateContext([]).images, []);
assert(!buildGenerateContext([]).prompt.includes('cottage'));
const long = Array.from({length:20}, (_,i)=>({id:String(i),role:'assistant',content:'',images:[`data:image/png;base64,${i}`],status:'complete'}));
assert.equal(buildGenerateContext(long).images.length, 12);
assert.match(buildGenerateContext(long).prompt, /Older image: not attached/);
assert.equal(buildGenerateContext(long, long[0].images[0]).images[0], long[0].images[0]);
console.log('Generate conversation context checks passed.');
