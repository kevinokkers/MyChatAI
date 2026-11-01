namespace MyChatAPI
{
    partial class Form1
    {
        /// <summary>
        ///  Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        ///  Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        ///  Required method for Designer support - do not modify
        ///  the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            textBoxOutput = new TextBox();
            buttonSpeak = new Button();
            comboBoxvoices = new ComboBox();
            SuspendLayout();
            // 
            // textBoxOutput
            // 
            textBoxOutput.Location = new Point(119, 43);
            textBoxOutput.Multiline = true;
            textBoxOutput.Name = "textBoxOutput";
            textBoxOutput.Size = new Size(468, 143);
            textBoxOutput.TabIndex = 0;
            // 
            // buttonSpeak
            // 
            buttonSpeak.Location = new Point(462, 239);
            buttonSpeak.Name = "buttonSpeak";
            buttonSpeak.Size = new Size(94, 29);
            buttonSpeak.TabIndex = 1;
            buttonSpeak.Text = "Speak";
            buttonSpeak.UseVisualStyleBackColor = true;
            buttonSpeak.Click += buttonSpeak_Click;
            // 
            // comboBoxvoices
            // 
            comboBoxvoices.FormattingEnabled = true;
            comboBoxvoices.Location = new Point(140, 200);
            comboBoxvoices.Name = "comboBoxvoices";
            comboBoxvoices.Size = new Size(296, 28);
            comboBoxvoices.TabIndex = 2;
            comboBoxvoices.SelectedIndexChanged += comboBoxvoices_SelectedIndexChanged;
            // 
            // Form1
            // 
            AutoScaleDimensions = new SizeF(8F, 20F);
            AutoScaleMode = AutoScaleMode.Font;
            ClientSize = new Size(800, 450);
            Controls.Add(comboBoxvoices);
            Controls.Add(buttonSpeak);
            Controls.Add(textBoxOutput);
            Name = "Form1";
            Text = "Form1";
            ResumeLayout(false);
            PerformLayout();
        }

        #endregion

        private TextBox textBoxOutput;
        private Button buttonSpeak;
        private ComboBox comboBoxvoices;
    }
}
