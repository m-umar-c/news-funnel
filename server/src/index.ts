import { config } from './config.js';
import { createApp } from './app.js';

createApp().listen(config.PORT, () => {
  console.log(`api listening on :${config.PORT}`);
});
