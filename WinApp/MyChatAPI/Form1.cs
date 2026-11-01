using System;
using System.Windows.Forms;
using System.Speech.Synthesis;
using System.Linq;
using Windows.Media.SpeechSynthesis;
using System.Collections.ObjectModel;
using Windows.UI.Xaml;

namespace MyChatAPI
{
    public partial class Form1 : Form
    {
        private System.Speech.Synthesis.SpeechSynthesizer _synth;
        private ReadOnlyCollection<InstalledVoice> _installedVoices;
        private InstalledVoice _installedVoice;
        public Form1()
        {
            InitializeComponent();

            _synth = new System.Speech.Synthesis.SpeechSynthesizer();
            _installedVoices = _synth.GetInstalledVoices();
            foreach (var v in _installedVoices)
                comboBoxvoices.Items.Add(v.VoiceInfo.Name);
            // set selected to female voice if exists
            _installedVoice = _installedVoices.ToList().Where(v => v.VoiceInfo.Gender == System.Speech.Synthesis.VoiceGender.Female).First();
            if (_installedVoice != null)
                comboBoxvoices.SelectedItem = _installedVoice.VoiceInfo.Name;
        }

        private void buttonSpeak_Click(object sender, EventArgs e)
        {
            var synth = new System.Speech.Synthesis.SpeechSynthesizer();

            if (_installedVoice != null)
                synth.SelectVoice(_installedVoice.VoiceInfo.Name);
            else
                // fallback to default voice
                synth.SelectVoiceByHints(System.Speech.Synthesis.VoiceGender.Female);
            synth.SpeakAsync(textBoxOutput.Text);
        }

        private void comboBoxvoices_SelectedIndexChanged(object sender, EventArgs e)
        {
            var selectedName = comboBoxvoices.SelectedItem as string;
            if (!string.IsNullOrWhiteSpace(selectedName))
                _installedVoice = _installedVoices.Where(x => x.VoiceInfo.Name == selectedName).First();
            else
                // fallback to female voice
                _synth.SelectVoiceByHints(System.Speech.Synthesis.VoiceGender.Female);
        }
    }
}
