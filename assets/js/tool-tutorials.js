(() => {
  const tutorials = {
    dta: {
      title: 'Gamry DTA to Excel',
      sample: 'assets/tutorials/tutorial_cv.DTA',
      steps: [
        'Choose a Gamry .DTA file.',
        'Choose whether to include metadata and click Convert to .xlsx.',
        'Open the downloaded workbook and select the curve sheet.'
      ]
    },
    equation: {
      title: 'Equation + Data Visualizer',
      sample: 'assets/tutorials/tutorial_decay.csv',
      steps: [
        'Load a CSV or Excel file with x and y columns.',
        'Add an equation, detect its parameters, and select the dataset as its x source.',
        'Render the plots and adjust the parameter sliders.'
      ]
    },
    trajectory: {
      title: 'Time-Series Plotter & GIF Builder',
      sample: 'assets/downloads/toolkit3_example_timeseries.xlsx',
      steps: [
        'Click Use example data or choose an Excel or CSV file and its time column.',
        'Choose the map type, dimensions, and variables.',
        'Click Create GIF, preview the animation, and download it.'
      ]
    }
  };
  const triggers = document.querySelectorAll('[data-tutorial]');
  if (!triggers.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'toolkit-tutorial-dialog';
  dialog.setAttribute('aria-labelledby', 'toolkitTutorialTitle');
  dialog.innerHTML = `
    <div class="toolkit-tutorial-header">
      <div>
        <p class="toolkit-tutorial-kicker">RESEARCH TOOLKIT · THREE STEPS</p>
        <h2 id="toolkitTutorialTitle"></h2>
      </div>
      <button type="button" class="toolkit-tutorial-close" aria-label="Close tutorial">×</button>
    </div>
    <video class="toolkit-tutorial-video" controls playsinline preload="metadata">
      <track kind="captions" srclang="en" label="English">
      Your browser does not support embedded video.
    </video>
    <div class="toolkit-tutorial-resources">
      <a class="toolkit-tutorial-sample" download>Download sample data</a>
      <a class="toolkit-tutorial-download" download>Download video</a>
    </div>
    <details class="toolkit-tutorial-steps">
      <summary>Read the three steps</summary>
      <ol></ol>
    </details>`;
  document.body.append(dialog);

  const title = dialog.querySelector('h2');
  const video = dialog.querySelector('video');
  const captions = dialog.querySelector('track');
  const sample = dialog.querySelector('.toolkit-tutorial-sample');
  const download = dialog.querySelector('.toolkit-tutorial-download');
  const steps = dialog.querySelector('ol');
  const closeButton = dialog.querySelector('button');
  let opener;
  for (const trigger of triggers) {
    trigger.addEventListener('click', () => {
      const key = trigger.dataset.tutorial;
      const guide = tutorials[key];
      if (!guide) return;
      opener = trigger;
      const asset = `assets/tutorials/${key}`;
      title.textContent = guide.title;
      video.setAttribute('aria-label', `${guide.title} video tutorial`);
      video.poster = `${asset}.webp`;
      captions.src = `${asset}.vtt`;
      video.src = `${asset}.mp4`;
      sample.href = guide.sample;
      download.href = video.src;
      steps.replaceChildren(...guide.steps.map(step => {
        const item = document.createElement('li');
        item.textContent = step;
        return item;
      }));
      dialog.querySelector('details').open = false;
      dialog.showModal();
      closeButton.focus();
      video.play().catch(() => {});
    });
  }
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    captions.removeAttribute('src');
    video.load();
    opener?.focus();
  });
})();
