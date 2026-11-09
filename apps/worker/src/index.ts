/** Persistent worker entry point. Queue adapter, retry policy and dead-letter handling are pending. */
async function main(){if(process.env.NODE_ENV!=="test")console.info("[dzaroza-worker] Foundation started; queue provider is not configured.");}
void main();
