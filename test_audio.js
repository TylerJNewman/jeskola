import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:5173/');

  await page.evaluate(async () => {
    // We can interact with the app via the DOM
    document.getElementById('btn-master-play').click();
    
    // Wait for init
    await new Promise(r => setTimeout(r, 500));
    
    // Click add buttons
    const btns = document.querySelectorAll('.add-module-btn');
    btns[0].click(); // Osc 1
    btns[0].click(); // Osc 2
    btns[1].click(); // Filter
    
    await new Promise(r => setTimeout(r, 500));
    
    const modules = document.querySelectorAll('.module');
    console.log("Modules created:", modules.length);
    
    // Grab Workspace instance from window
    const ws = window._workspace;
    console.log("Workspace found:", !!ws);
    
    const osc1 = modules[1]; // Osc 1
    const osc2 = modules[2]; // Osc 2
    const filter = modules[3]; // Filter
    const master = modules[0]; // Master is index 0
    
    const osc1Out = osc1.querySelector('.port.output[data-port-id="audio"]');
    const filterIn = filter.querySelector('.port.input[data-port-id="audio"]');
    
    const filterOut = filter.querySelector('.port.output[data-port-id="audio"]');
    const masterIn = master.querySelector('.port.input[data-port-id="audio"]');
    
    const osc2Out = osc2.querySelector('.port.output[data-port-id="audio"]');
    const filterCv = filter.querySelector('.port.input.cv[data-port-id="cutoff"]');
    
    console.log("Ports found:", !!osc1Out, !!filterIn, !!filterOut, !!masterIn, !!osc2Out, !!filterCv);
    
    // Simulate drops
    ws.attemptConnection(osc1Out, filterIn);
    console.log("Connected Osc1 -> Filter IN");
    
    ws.attemptConnection(filterOut, masterIn);
    console.log("Connected Filter OUT -> Master IN");
    
    ws.attemptConnection(osc2Out, filterCv);
    console.log("Connected Osc2 -> Filter CV CUT");
    
    console.log("Connections length:", ws.connections.length);
  });
  
  await browser.close();
})();
